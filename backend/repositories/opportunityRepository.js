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

export const countActive = (organizationId) =>
  Opportunity.countDocuments({
    organizationId,
    status: "Active",
    isDeleted: { $ne: true },
  });

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
    {
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
    },
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
