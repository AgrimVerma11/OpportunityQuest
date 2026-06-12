import Opportunity from "../models/Opportunity.js";

// Repository — the only place that talks to the Opportunity collection.
// No business rules here; just database operations.

export const createOpportunity = (data) => Opportunity.create(data);

// Public feed: active, not past deadline, not soft-deleted.
export const findActiveOpportunities = () =>
  Opportunity.find({
    status: "Active",
    deadline: { $gt: new Date() },
    isDeleted: { $ne: true },
  })
    .populate("postedBy", "name role department")
    .sort({ createdAt: -1 });

// Every (non-deleted) opportunity created by a given faculty member.
export const findByOwner = (ownerId) =>
  Opportunity.find({ postedBy: ownerId, isDeleted: { $ne: true } }).sort({
    createdAt: -1,
  });

export const findById = (id) => Opportunity.findById(id);

export const findByIdWithOwner = (id) =>
  Opportunity.findById(id).populate("postedBy", "name role department");

// Persist a loaded document after the service has mutated it.
export const save = (opportunity) => opportunity.save();

export const aggregateCategoryStats = () =>
  Opportunity.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
