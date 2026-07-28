import mongoose from "mongoose";
import Opportunity from "../models/Opportunity.js";

// Repository — the only place that talks to the Opportunity collection.
// No business rules here; just database operations. Every read is scoped to a
// single organization so tenants never see one another's records.

export const createOpportunity = (data) => Opportunity.create(data);

// Feed for one organization: active, not past deadline, not soft-deleted.
export const findActiveOpportunities = (organizationId) =>
  Opportunity.find({
    organizationId,
    status: "Active",
    deadline: { $gt: new Date() },
    isDeleted: { $ne: true },
  })
    .populate("postedBy", "name role department prefix profileImage")
    .sort({ createdAt: -1 });

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

export const aggregateCategoryStats = (organizationId) =>
  Opportunity.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        isDeleted: { $ne: true },
      },
    },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
