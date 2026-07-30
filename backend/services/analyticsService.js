import * as userRepo from "../repositories/userRepository.js";
import * as opportunityRepo from "../repositories/opportunityRepository.js";
import * as applicationRepo from "../repositories/applicationRepository.js";
import { ROLES, ACCOUNT_STATUS } from "../constants/userConstants.js";
import { APPLICATION_STATUSES } from "../constants/applicationConstants.js";
import { OPPORTUNITY_CATEGORIES } from "../constants/opportunityConstants.js";

// Service — the read-only, organization-scoped analytics behind the coordinator
// dashboard. Every figure comes from the coordinator's own organization; the
// aggregations all match on organizationId, so nothing from another institution
// can appear. The pipelines run in parallel and are composed into one payload.

const TREND_DAYS = 30;

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
    activeOpportunities,
    categoryRows,
    totalApplications,
    funnelRows,
    dailyRows,
    topOpportunities,
  ] = await Promise.all([
    userRepo.countByRole(organizationId, ROLES.STUDENT),
    userRepo.facultyStatusBreakdown(organizationId),
    opportunityRepo.countActive(organizationId),
    opportunityRepo.aggregateCategoryStats(organizationId),
    applicationRepo.countByOrg(organizationId),
    applicationRepo.funnelByOrg(organizationId),
    applicationRepo.dailyCountsByOrg(organizationId, since),
    applicationRepo.topOpportunitiesByApplications(organizationId, 5),
  ]);

  const facultyByStatus = toCounts(facultyRows);

  return {
    kpis: {
      students,
      activeFaculty: facultyByStatus[ACCOUNT_STATUS.ACTIVE] || 0,
      pendingFaculty: facultyByStatus[ACCOUNT_STATUS.PENDING] || 0,
      activeOpportunities,
      totalApplications,
    },
    applicationFunnel: fillKeys(toCounts(funnelRows), APPLICATION_STATUSES),
    opportunitiesByCategory: fillKeys(
      toCounts(categoryRows),
      OPPORTUNITY_CATEGORIES
    ),
    facultyByStatus: fillKeys(facultyByStatus, Object.values(ACCOUNT_STATUS)),
    topOpportunities,
    applicationsTrend: fillDays(dailyRows, since, TREND_DAYS),
  };
};
