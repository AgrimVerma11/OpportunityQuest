import mongoose from "mongoose";

import Application from "../models/Application.js";
import { APPLICATION_STATUS } from "../constants/applicationConstants.js";

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

// Rank of each main-path funnel stage. Rejected/Withdrawn are terminal exits,
// not ranked — they can branch off from Applied, Viewed or Shortlisted alike
// (see STATUS_TRANSITIONS), so they say nothing about how far an application
// actually progressed before exiting.
const FUNNEL_RANK = {
  [APPLICATION_STATUS.APPLIED]: 1,
  [APPLICATION_STATUS.VIEWED]: 2,
  [APPLICATION_STATUS.SHORTLISTED]: 3,
  [APPLICATION_STATUS.SELECTED]: 4,
};

// The application funnel, as cumulative "reached at least this stage" counts
// — Applied is every application that ever existed, Viewed is every
// application that got at least as far as Viewed, and so on — rather than a
// snapshot of *current* status. A snapshot reads as nonsensical for a funnel
// (e.g. two Selected applications with Applied/Viewed/Shortlisted all
// reading 0, because those two have already moved past those stages) and
// breaks the "N% went on to the next stage" conversion math the dashboard
// shows under each bar.
//
// "Reached at least stage X" is derived from each application's peak rank
// across its own statusHistory (not just its current status), because
// Viewed is a skippable stage — a faculty member can shortlist or reject an
// application it never opened first (Applied → Shortlisted is a legal direct
// transition). Using peak rank means an application that skipped Viewed on
// its way to Shortlisted still correctly counts toward "reached Viewed": it
// demonstrably progressed further than that gate, even though the discrete
// Viewed status was never set. This guarantees the bars are monotonically
// non-increasing by construction, not by coincidence.
//
// Rejected/Withdrawn are reported alongside as ordinary *current*-status
// counts (not cumulative — an application is either rejected right now or it
// isn't), matching how the dashboard shows them: outcomes beside the funnel,
// not stages within it.
export const cumulativeFunnelByOrg = async (organizationId, category) => {
  const pipeline = [
    { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
  ];
  if (category) {
    pipeline.push(
      {
        $lookup: {
          from: "opportunities",
          localField: "opportunity",
          foreignField: "_id",
          as: "opportunity",
        },
      },
      { $unwind: "$opportunity" },
      { $match: { "opportunity.category": category } }
    );
  }
  pipeline.push(
    {
      $addFields: {
        peakRank: {
          $max: {
            $map: {
              input: "$statusHistory",
              as: "h",
              in: {
                $switch: {
                  branches: Object.entries(FUNNEL_RANK).map(([status, rank]) => ({
                    case: { $eq: ["$$h.status", status] },
                    then: rank,
                  })),
                  default: 0,
                },
              },
            },
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        [APPLICATION_STATUS.APPLIED]: { $sum: { $cond: [{ $gte: ["$peakRank", 1] }, 1, 0] } },
        [APPLICATION_STATUS.VIEWED]: { $sum: { $cond: [{ $gte: ["$peakRank", 2] }, 1, 0] } },
        [APPLICATION_STATUS.SHORTLISTED]: { $sum: { $cond: [{ $gte: ["$peakRank", 3] }, 1, 0] } },
        [APPLICATION_STATUS.SELECTED]: { $sum: { $cond: [{ $gte: ["$peakRank", 4] }, 1, 0] } },
        [APPLICATION_STATUS.REJECTED]: {
          $sum: { $cond: [{ $eq: ["$status", APPLICATION_STATUS.REJECTED] }, 1, 0] },
        },
        [APPLICATION_STATUS.WITHDRAWN]: {
          $sum: { $cond: [{ $eq: ["$status", APPLICATION_STATUS.WITHDRAWN] }, 1, 0] },
        },
      },
    }
  );
  const [result] = await Application.aggregate(pipeline);
  return {
    Applied: result?.Applied || 0,
    Viewed: result?.Viewed || 0,
    Shortlisted: result?.Shortlisted || 0,
    Selected: result?.Selected || 0,
    Rejected: result?.Rejected || 0,
    Withdrawn: result?.Withdrawn || 0,
  };
};

// The literal count of applications currently sitting untouched in Applied —
// never opened, shortlisted or rejected. Distinct from the funnel's own
// Applied figure above (cumulative — "reached at least Applied", i.e. every
// application that exists): this is specifically what the coordinator
// dashboard's "awaiting first review" figure means, and it would be wrong if
// sourced from the cumulative funnel instead.
export const countAwaitingFirstReview = (organizationId) =>
  Application.countDocuments({ organizationId, status: APPLICATION_STATUS.APPLIED });

// Applications grouped by their opportunity's category — the demand side of
// the applications-per-opportunity-by-category comparison (the supply side
// is opportunityRepo.aggregateCategoryStats).
export const applicationsByCategory = (organizationId) =>
  Application.aggregate([
    { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
    {
      $lookup: {
        from: "opportunities",
        localField: "opportunity",
        foreignField: "_id",
        as: "opportunity",
      },
    },
    { $unwind: "$opportunity" },
    { $group: { _id: "$opportunity.category", count: { $sum: 1 } } },
  ]);

// Applications by the applicant's year and by the opportunity's category,
// optionally scoped to one gender — powers the coordinator dashboard's
// student-engagement panel. A single aggregation ($facet) computes both
// breakdowns off the same gender-filtered base set rather than running two
// separate queries.
export const studentEngagement = (organizationId, gender) => {
  const pipeline = [
    { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
    {
      $lookup: {
        from: "users",
        localField: "student",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
  ];
  if (gender) pipeline.push({ $match: { "student.gender": gender } });
  pipeline.push({
    $facet: {
      byYear: [{ $group: { _id: "$student.year", count: { $sum: 1 } } }],
      byCategory: [
        {
          $lookup: {
            from: "opportunities",
            localField: "opportunity",
            foreignField: "_id",
            as: "opportunity",
          },
        },
        { $unwind: "$opportunity" },
        { $group: { _id: "$opportunity.category", count: { $sum: 1 } } },
      ],
    },
  });
  return Application.aggregate(pipeline);
};

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

// A page of the organization's applications, newest first, optionally
// filtered by status — the cross-opportunity applications queue behind the
// coordinator's Applications tab (and the Total Applications / "awaiting
// first review" drill-downs on Overview). Explicitly select()ed to student/
// opportunity/status/createdAt only: this is the one surface in the app that
// aggregates applications across an entire organization in a single list, so
// it deliberately never carries coverLetter or resume — those stay reachable
// only through the existing per-opportunity Applicants view.
export const listForOrg = async (organizationId, { status, page, limit }) => {
  const query = { organizationId };
  if (status) query.status = status;
  const [applications, total] = await Promise.all([
    Application.find(query)
      .select("student opportunity status createdAt")
      .populate("student", "name email profileImage")
      .populate("opportunity", "title category")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Application.countDocuments(query),
  ]);
  return { applications, total, page, limit, hasMore: page * limit < total };
};

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
        category: "$opportunity.category",
        applications: 1,
      },
    },
  ]);
