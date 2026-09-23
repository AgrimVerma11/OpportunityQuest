import * as userRepo from "../repositories/userRepository.js";
import * as opportunityRepo from "../repositories/opportunityRepository.js";
import * as applicationRepo from "../repositories/applicationRepository.js";
import { ROLES, ACCOUNT_STATUS } from "../constants/userConstants.js";
import { OPPORTUNITY_CATEGORIES } from "../constants/opportunityConstants.js";

// Service — the read-only, organization-scoped analytics behind the coordinator
// dashboard. Every figure comes from the coordinator's own organization; the
// aggregations all match on organizationId, so nothing from another institution
// can appear. The pipelines run in parallel and are composed into one payload.

const TREND_DAYS = 30;
const TREND_PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90 };

// Faculty-activity range resolution. Custom ranges are clamped to
// MAX_RANGE_MONTHS regardless of what the client asked for, and topN is
// clamped independently of the Joi cap already applied at the route — belt
// and suspenders, since this function is also the unit tested surface.
const MAX_RANGE_MONTHS = 24;
const MAX_TOP_N = 100;
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Parses an already-validated "Mon YYYY" token (the route's Joi schema
// guarantees this shape) into the first and last instant of that calendar
// month, UTC.
const monthBounds = (token) => {
  const [abbr, yearStr] = token.split(" ");
  const monthIndex = MONTH_ABBR.indexOf(abbr);
  const year = Number(yearStr);
  return {
    from: new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0)),
    to: new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)),
  };
};

// Resolves a faculty-activity request's mode into concrete date bounds.
export const resolveFacultyActivityRange = ({ mode, month, from, to }) => {
  if (mode === "month") return monthBounds(month);

  if (mode === "ytd") {
    const now = new Date();
    return { from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), to: now };
  }

  // custom — order the two endpoints defensively (the caller's "from"/"to"
  // labels aren't guaranteed chronological), then clamp the span.
  const a = monthBounds(from);
  const b = monthBounds(to);
  const start = a.from <= b.from ? a.from : b.from;
  let end = a.to >= b.to ? a.to : b.to;

  const maxEnd = new Date(start);
  maxEnd.setUTCMonth(maxEnd.getUTCMonth() + MAX_RANGE_MONTHS);
  if (end > maxEnd) end = maxEnd;

  return { from: start, to: end };
};

export const getFacultyActivity = async (organizationId, { mode, month, from, to, topN, sortBy }) => {
  const range = resolveFacultyActivityRange({ mode, month, from, to });
  const rows = await opportunityRepo.facultyActivityByRange(
    organizationId,
    range.from,
    range.to,
    sortBy
  );
  // `rows.length` (before the topN cap) is how many distinct faculty posted
  // in the range at all — the participation figure the dashboard shows
  // alongside the (possibly shorter) leaderboard.
  return {
    faculty: rows.slice(0, Math.min(topN, MAX_TOP_N)),
    participation: rows.length,
  };
};

// Postings (supply) vs. applications (demand) per category, in one payload —
// the source for the "Applications per Opportunity" coordinator panel.
export const getCategoryDemand = async (organizationId) => {
  const [supplyRows, demandRows] = await Promise.all([
    opportunityRepo.aggregateCategoryStats(organizationId),
    applicationRepo.applicationsByCategory(organizationId),
  ]);
  const supply = fillKeys(toCounts(supplyRows), OPPORTUNITY_CATEGORIES);
  const demand = fillKeys(toCounts(demandRows), OPPORTUNITY_CATEGORIES);
  return OPPORTUNITY_CATEGORIES.map((category) => ({
    category,
    postings: supply[category],
    applications: demand[category],
  }));
};

// The application funnel (cumulative "reached at least this stage" for
// Applied/Viewed/Shortlisted/Selected, current-status for the Rejected/
// Withdrawn outcomes — see cumulativeFunnelByOrg), optionally scoped to one
// opportunity category.
export const getFunnelByCategory = (organizationId, category) =>
  applicationRepo.cumulativeFunnelByOrg(organizationId, category);

const STUDENT_YEARS = [1, 2, 3, 4];

// Applications by applicant year and by opportunity category, optionally
// scoped to one gender.
export const getStudentEngagement = async (organizationId, gender) => {
  const [facetResult] = await applicationRepo.studentEngagement(
    organizationId,
    gender
  );
  return {
    byYear: fillKeys(toCounts(facetResult.byYear), STUDENT_YEARS),
    byCategory: fillKeys(toCounts(facetResult.byCategory), OPPORTUNITY_CATEGORIES),
  };
};

// The organization's full opportunity listing, for the Opportunities tab.
export const getOpportunitiesList = (organizationId, { status, category, sort }) =>
  opportunityRepo.listForOrg(organizationId, { status, category, sort });

// The organization's cross-opportunity applications queue, for the
// Applications tab and the Total Applications / "awaiting first review"
// drill-downs on Overview.
export const getApplicationsList = (organizationId, { page, limit, status }) =>
  applicationRepo.listForOrg(organizationId, { status, page, limit });

// Student counts per year, optionally scoped to one gender and/or branch —
// distinct from getStudentEngagement's byYear above, which counts
// *applications* from students of that year, not the students themselves.
export const getStudentYearCounts = async (organizationId, gender, branch) => {
  const rows = await userRepo.studentCountsByYear(organizationId, gender, branch);
  return fillKeys(toCounts(rows), STUDENT_YEARS);
};

// The distinct branch values in use, to populate the Students tab's branch
// filter with real data rather than a guessed/hardcoded list.
export const getStudentBranches = (organizationId) =>
  userRepo.distinctStudentBranches(organizationId);

// Repository call behind each activity-trend series — kept as a lookup table
// rather than a switch so an invalid series (already ruled out by Joi at the
// route) can never silently fall through to the wrong data source.
const TREND_SERIES_REPOS = {
  applications: applicationRepo.dailyCountsByOrg,
  signups: userRepo.dailySignupsByOrg,
  postings: opportunityRepo.dailyPostingCountsByOrg,
};

// The Overview activity trend, over a caller-chosen period (7/30/90 days) and
// series (Applications / Signups / Postings). Shares fillDays with
// getCoordinatorAnalytics's own (fixed 30-day, applications-only) trend below,
// so a gap-free day-by-day shape is computed identically either way.
export const getActivityTrend = async (organizationId, { period, series }) => {
  const days = TREND_PERIOD_DAYS[period];
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const rows = await TREND_SERIES_REPOS[series](organizationId, since);
  return fillDays(rows, since, days);
};

// Opportunity display statuses, in the order the dashboard shows them.
const OPPORTUNITY_DISPLAY_STATUSES = ["Active", "Expired", "Archived", "Closed"];

// [{ _id, count }] → { [_id]: count }.
const toCounts = (rows) =>
  rows.reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});

// Zero-fills every expected key, in order, so the UI can render a stable shape
// (e.g. a category with no opportunities still appears, as 0).
const fillKeys = (counts, keys) =>
  keys.reduce((acc, k) => {
    acc[k] = counts[k] || 0;
    return acc;
  }, {});

// A continuous, gap-free day-by-day series for the activity trend (UTC days, to
// match the aggregation's date grouping).
const fillDays = (rows, since, days) => {
  const counts = toCounts(rows);
  const series = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, count: counts[key] || 0 });
  }
  return series;
};

export const getCoordinatorAnalytics = async (organizationId) => {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (TREND_DAYS - 1));

  const [
    students,
    facultyRows,
    oppStatusRows,
    categoryRows,
    totalApplications,
    applicationFunnel,
    awaitingFirstReview,
    dailyRows,
    topOpportunities,
  ] = await Promise.all([
    userRepo.countByRole(organizationId, ROLES.STUDENT),
    userRepo.facultyStatusBreakdown(organizationId),
    opportunityRepo.opportunityStatusBreakdown(organizationId),
    opportunityRepo.aggregateCategoryStats(organizationId),
    applicationRepo.countByOrg(organizationId),
    applicationRepo.cumulativeFunnelByOrg(organizationId),
    applicationRepo.countAwaitingFirstReview(organizationId),
    applicationRepo.dailyCountsByOrg(organizationId, since),
    applicationRepo.topOpportunitiesByApplications(organizationId, 5),
  ]);

  const facultyByStatus = toCounts(facultyRows);
  const opportunitiesByStatus = fillKeys(
    toCounts(oppStatusRows),
    OPPORTUNITY_DISPLAY_STATUSES
  );

  return {
    kpis: {
      students,
      activeFaculty: facultyByStatus[ACCOUNT_STATUS.ACTIVE] || 0,
      pendingFaculty: facultyByStatus[ACCOUNT_STATUS.PENDING] || 0,
      // Truly active — accepting applications now (expired items excluded).
      activeOpportunities: opportunitiesByStatus.Active,
      totalApplications,
    },
    applicationFunnel,
    // The literal "still sitting untouched" count — distinct from
    // applicationFunnel.Applied above, which is cumulative (see
    // cumulativeFunnelByOrg) and always equals totalApplications.
    awaitingFirstReview,
    opportunitiesByCategory: fillKeys(
      toCounts(categoryRows),
      OPPORTUNITY_CATEGORIES
    ),
    opportunitiesByStatus,
    facultyByStatus: fillKeys(facultyByStatus, Object.values(ACCOUNT_STATUS)),
    topOpportunities,
    applicationsTrend: fillDays(dailyRows, since, TREND_DAYS),
  };
};
