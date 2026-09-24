import mongoose from "mongoose";
import Opportunity from "../models/Opportunity.js";

// Repository — the only place that talks to the Opportunity collection.
// No business rules here; just database operations. Every read is scoped to a
// single organization so tenants never see one another's records.

export const createOpportunity = (data) => Opportunity.create(data);

// Escapes user text so it is safe to use inside a regular expression.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Feed for one organization: active, in-date, not soft-deleted — filtered and
// paginated on the server. Returns the requested page plus paging metadata,
// rather than the entire collection.
export const findActiveOpportunities = async (
  organizationId,
  { page, limit, filters = {} }
) => {
  const query = {
    organizationId,
    status: "Active",
    deadline: { $gt: new Date() },
    isDeleted: { $ne: true },
  };

  if (filters.category) query.category = filters.category;
  if (filters.branch) query.eligibleBranches = { $in: ["All", filters.branch] };
  if (filters.year) query.eligibleYears = { $in: ["All", filters.year] };
  if (filters.search) {
    query.title = { $regex: escapeRegex(filters.search), $options: "i" };
  }

  const [opportunities, total] = await Promise.all([
    Opportunity.find(query)
      .populate("postedBy", "name role department prefix profileImage")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Opportunity.countDocuments(query),
  ]);

  return {
    opportunities,
    pagination: {
      page,
      limit,
      total,
      hasMore: page * limit < total,
    },
  };
};

// Every (non-deleted) opportunity created by a given faculty member.
export const findByOwner = (ownerId) =>
  Opportunity.find({ postedBy: ownerId, isDeleted: { $ne: true } }).sort({
    createdAt: -1,
  });

export const findById = (id) => Opportunity.findById(id);

export const findByIdWithOwner = (id, organizationId) =>
  Opportunity.findOne({ _id: id, organizationId }).populate(
    "postedBy",
    "name role department prefix profileImage"
  );

// Persist a loaded document after the service has mutated it.
export const save = (opportunity) => opportunity.save();

// Adjust the denormalized application counter (kept as a best-effort cache;
// dashboards read the live count from the applications collection).
export const incrementApplicationsCount = (id, delta) =>
  Opportunity.findByIdAndUpdate(id, { $inc: { applicationsCount: delta } });

// Live opportunity counts per faculty member (postedBy), for the coordinator's
// faculty roster's "Opportunities posted" column. Excludes soft-deleted
// postings, matching every other opportunity query in this app.
export const opportunityCountsByFaculty = (organizationId) =>
  Opportunity.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        isDeleted: { $ne: true },
      },
    },
    { $group: { _id: "$postedBy", count: { $sum: 1 } } },
  ]);

// One faculty member's all-time totals: opportunities posted and the live
// applications those postings have drawn. Distinct from
// facultyActivityByRange, which is date-scoped and org-wide (the
// leaderboard) — this is the stable, whole-career figure for a profile view,
// so it doesn't change depending on which range happened to be selected on
// the leaderboard when the coordinator clicked through.
export const facultyPostingStats = (facultyId) =>
  Opportunity.aggregate([
    {
      $match: {
        postedBy: new mongoose.Types.ObjectId(facultyId),
        isDeleted: { $ne: true },
      },
    },
    {
      $lookup: {
        from: "applications",
        localField: "_id",
        foreignField: "opportunity",
        as: "applications",
      },
    },
    {
      $group: {
        _id: null,
        postings: { $sum: 1 },
        applications: { $sum: { $size: "$applications" } },
      },
    },
  ]);

export const countActive = (organizationId) =>
  Opportunity.countDocuments({
    organizationId,
    status: "Active",
    isDeleted: { $ne: true },
  });

// The $addFields stage that derives Active/Expired/Archived/Closed *display*
// status ("Expired" = status Active but the deadline has passed). Shared by
// opportunityStatusBreakdown and listForOrg below so the two can never derive
// "Expired" differently from one another.
const DISPLAY_STATUS_STAGE = {
  $addFields: {
    displayStatus: {
      $switch: {
        branches: [
          { case: { $eq: ["$status", "Closed"] }, then: "Closed" },
          { case: { $eq: ["$status", "Archived"] }, then: "Archived" },
          {
            case: {
              $and: [
                { $eq: ["$status", "Active"] },
                { $lt: ["$deadline", "$$NOW"] },
              ],
            },
            then: "Expired",
          },
        ],
        default: "Active",
      },
    },
  },
};

// Opportunity counts by *display* status: Active / Expired / Archived / Closed.
// "Expired" is derived (status Active but the deadline has passed), matching how
// the faculty dashboard labels opportunities, so the coordinator sees the same
// distinction instead of expired items being lumped in with active ones.
export const opportunityStatusBreakdown = (organizationId) =>
  Opportunity.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        isDeleted: { $ne: true },
      },
    },
    DISPLAY_STATUS_STAGE,
    { $group: { _id: "$displayStatus", count: { $sum: 1 } } },
  ]);

export const aggregateCategoryStats = (organizationId, { status } = {}) =>
  Opportunity.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        isDeleted: { $ne: true },
        ...(status ? { status } : {}),
      },
    },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

// Opportunities posted (and the live applications those postings have drawn)
// per faculty member, within a date range — the source for the coordinator
// dashboard's faculty-engagement leaderboard across Month / Year-to-Date /
// Custom Range views. Applications are counted from the live Application
// collection rather than the denormalized applicationsCount cache, matching
// how the rest of this service reads (see topOpportunitiesByApplications),
// so a stale cache can never skew who appears to be "most active". Ranked by
// applications received by default; pass sortBy: "postings" to rank by
// posting count instead.
export const facultyActivityByRange = (organizationId, from, to, sortBy = "apps") =>
  Opportunity.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        isDeleted: { $ne: true },
        createdAt: { $gte: from, $lte: to },
      },
    },
    {
      $lookup: {
        from: "applications",
        localField: "_id",
        foreignField: "opportunity",
        as: "applications",
      },
    },
    {
      $group: {
        _id: "$postedBy",
        postings: { $sum: 1 },
        apps: { $sum: { $size: "$applications" } },
      },
    },
    { $sort: sortBy === "postings" ? { postings: -1, apps: -1 } : { apps: -1, postings: -1 } },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "faculty",
      },
    },
    { $unwind: "$faculty" },
    {
      $project: {
        _id: 0,
        facultyId: "$_id",
        name: "$faculty.name",
        department: "$faculty.department",
        postings: 1,
        apps: 1,
      },
    },
  ]);

// New opportunities posted per calendar day since `since` — the "Postings"
// series on the coordinator dashboard's activity trend.
export const dailyPostingCountsByOrg = (organizationId, since) =>
  Opportunity.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        isDeleted: { $ne: true },
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

// Hard cap for listForOrg below — independent of how many opportunities an
// organization actually has, so this listing can't become a cheap
// resource-exhaustion lever as it grows. Sized generously above any pilot
// institution's real volume; listForOrg requests one extra row past this cap
// so it can report `capped` rather than silently truncating with no signal
// that anything was left out. Revisit with real pagination (and, since the
// Opportunities tab's "By category" view groups the full result client-side,
// a matching redesign of that grouping — see StudentsByYear's lazy-loaded
// group pattern for the shape that would take) if this is ever hit in
// practice.
const MAX_LISTING = 2000;

// The full opportunity listing behind the coordinator's Opportunities tab:
// title, category, status, deadline and applicationsCount, with the same
// Active/Expired/Archived/Closed *display* status opportunityStatusBreakdown
// computes (shared via DISPLAY_STATUS_STAGE), so a status filter here matches
// exactly what the status tiles show. applicationsCount (not a live count) is
// used for the "fewest applications" sort — acceptable for ordering a listing,
// unlike the KPI totals above which deliberately read live data.
export const listForOrg = async (organizationId, { status, category, sort } = {}) => {
  const pipeline = [
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        isDeleted: { $ne: true },
        ...(category ? { category } : {}),
      },
    },
    DISPLAY_STATUS_STAGE,
  ];

  if (status) pipeline.push({ $match: { displayStatus: status } });

  if (sort === "deadline") pipeline.push({ $sort: { deadline: 1 } });
  else if (sort === "applications") pipeline.push({ $sort: { applicationsCount: 1 } });
  else pipeline.push({ $sort: { createdAt: -1 } });

  pipeline.push(
    // One extra row past the cap, purely to detect whether there's more.
    { $limit: MAX_LISTING + 1 },
    {
      $lookup: {
        from: "users",
        localField: "postedBy",
        foreignField: "_id",
        as: "postedBy",
      },
    },
    { $unwind: "$postedBy" },
    {
      $project: {
        title: 1,
        category: 1,
        status: "$displayStatus",
        deadline: 1,
        applicationsCount: 1,
        createdAt: 1,
        postedBy: "$postedBy.name",
      },
    }
  );

  const rows = await Opportunity.aggregate(pipeline);
  const capped = rows.length > MAX_LISTING;
  return { opportunities: capped ? rows.slice(0, MAX_LISTING) : rows, capped };
};
