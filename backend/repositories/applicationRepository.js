import mongoose from "mongoose";

import Application from "../models/Application.js";

// Repository — the only place that talks to the Application collection.

export const create = (data) => Application.create(data);

export const findById = (id) => Application.findById(id);

// Populated for detail views: full applicant profile + the parent opportunity.
export const findByIdPopulated = (id) =>
  Application.findById(id)
    .populate(
      "student",
      "name email branch year gender skills society projects interests profileImage bio linkedinUrl role"
    )
    .populate("opportunity", "title category postedBy deadline status");

export const findOne = (filter) => Application.findOne(filter);

// A student's own applications, newest first.
export const findByStudent = (studentId) =>
  Application.find({ student: studentId })
    .populate("opportunity", "title category deadline status isDeleted")
    .sort({ createdAt: -1 });

// Applicants for one opportunity, optionally filtered by status.
export const findByOpportunity = (opportunityId, status) => {
  const filter = { opportunity: opportunityId };
  if (status) filter.status = status;
  return Application.find(filter)
    .populate("student", "name email branch year gender skills profileImage")
    .sort({ createdAt: -1 });
};

export const save = (application) => application.save();

// ── Analytics (all org-scoped) ────────────────────────────────────

export const countByOrg = (organizationId) =>
  Application.countDocuments({ organizationId });

// Application counts grouped by status — the conversion funnel.
export const funnelByOrg = (organizationId) =>
  Application.aggregate([
    { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

// Applications per calendar day since `since`, for the activity trend.
export const dailyCountsByOrg = (organizationId, since) =>
  Application.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
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

// The opportunities with the most applications, with their titles.
export const topOpportunitiesByApplications = (organizationId, limit = 5) =>
  Application.aggregate([
    { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
    { $group: { _id: "$opportunity", applications: { $sum: 1 } } },
    { $sort: { applications: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "opportunities",
        localField: "_id",
        foreignField: "_id",
        as: "opportunity",
      },
    },
    { $unwind: "$opportunity" },
    {
      $project: {
        _id: 0,
        opportunityId: "$_id",
        title: "$opportunity.title",
        applications: 1,
      },
    },
  ]);
