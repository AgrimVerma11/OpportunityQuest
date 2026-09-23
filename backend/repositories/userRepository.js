import mongoose from "mongoose";

import User from "../models/User.js";
import { ROLES, ACCOUNT_STATUS } from "../constants/userConstants.js";

// User data access used outside the auth flow (e.g. eligibility checks and
// application analytics).

export const findById = (id) => User.findById(id);

// Tenant-scoped lookup — used when a coordinator acts on an account, so one
// organization can never approve another's. Accepts a session so the read can
// join the same transaction as the write that follows it.
export const findByIdInOrg = (id, organizationId, session = null) =>
  User.findOne({ _id: id, organizationId }).session(session);

// Active coordinators of an organization — the recipients of faculty-approval
// notifications. Served by the { organizationId, role, accountStatus } index.
export const findActiveCoordinatorsByOrg = (organizationId) =>
  User.find({
    organizationId,
    role: ROLES.COORDINATOR,
    accountStatus: ACCOUNT_STATUS.ACTIVE,
  }).select("_id email name");

export const findPendingFacultyByOrg = (organizationId) =>
  User.find({
    organizationId,
    role: ROLES.FACULTY,
    accountStatus: ACCOUNT_STATUS.PENDING,
  })
    .select("-password")
    .sort({ createdAt: 1 });

export const setAccountStatus = (id, update, session = null) =>
  User.findByIdAndUpdate(id, update, {
    returnDocument: "after",
    session,
  }).select("-password");

export const incrementApplicationsSubmitted = (id, delta) =>
  User.findByIdAndUpdate(id, { $inc: { applicationsSubmitted: delta } });

// ── Analytics ─────────────────────────────────────────────────────

export const countByRole = (organizationId, role) =>
  User.countDocuments({ organizationId, role });

// Full faculty roster for the coordinator directory — all statuses, newest
// first, with who approved them (if anyone).
export const findFacultyByOrg = (organizationId) =>
  User.find({ organizationId, role: ROLES.FACULTY })
    .select("name department employeeId accountStatus createdAt approvedAt approvedBy profileImage")
    .populate("approvedBy", "name")
    .sort({ createdAt: -1 });

// A page of the organization's students, newest first, plus the total.
// Optionally scoped to one gender, year and/or branch — the Students tab's
// filters and "By year" grouping all drive this same query rather than
// filtering a fully-loaded roster client-side, so it stays cheap as the
// roster grows.
export const findStudentsByOrg = async (
  organizationId,
  { page, limit, gender, year, branch }
) => {
  const query = { organizationId, role: ROLES.STUDENT };
  if (gender) query.gender = gender;
  if (year) query.year = year;
  if (branch) query.branch = branch;
  const [students, total] = await Promise.all([
    User.find(query)
      .select("name email branch year createdAt profileImage accountStatus")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(query),
  ]);
  return { students, total, page, limit, hasMore: page * limit < total };
};

// Student counts per year (1-4), optionally scoped to one gender and/or
// branch — powers the Students tab's "By year" group headers (a count)
// without loading the whole, potentially large, roster to compute them
// client-side.
export const studentCountsByYear = (organizationId, gender, branch) =>
  User.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        role: ROLES.STUDENT,
        ...(gender ? { gender } : {}),
        ...(branch ? { branch } : {}),
      },
    },
    { $group: { _id: "$year", count: { $sum: 1 } } },
  ]);

// The distinct, non-empty branch strings actually in use among this
// organization's students, sorted — populates the Students tab's branch
// filter with real values rather than a hardcoded/assumed list, since branch
// has no controlled vocabulary in this schema.
export const distinctStudentBranches = async (organizationId) => {
  const branches = await User.distinct("branch", {
    organizationId,
    role: ROLES.STUDENT,
    branch: { $nin: ["", null] },
  });
  return branches.sort((a, b) => a.localeCompare(b));
};

// New student/faculty registrations per calendar day since `since` — the
// "Signups" series on the coordinator dashboard's activity trend. Scoped to
// Student and Faculty (never Coordinator/SuperAdmin): an organization holds
// only a handful of those, so counting them would just add noise, not signal,
// to a growth trend.
export const dailySignupsByOrg = (organizationId, since) =>
  User.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        role: { $in: [ROLES.STUDENT, ROLES.FACULTY] },
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

// Faculty grouped by account status, for the coordinator dashboard.
export const facultyStatusBreakdown = (organizationId) =>
  User.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        role: ROLES.FACULTY,
      },
    },
    // A missing accountStatus is treated as the schema default (Active) — the
    // same value Mongoose applies on read, so this aggregation agrees with the
    // faculty roster instead of dropping those records under a null bucket.
    {
      $group: {
        _id: { $ifNull: ["$accountStatus", ACCOUNT_STATUS.ACTIVE] },
        count: { $sum: 1 },
      },
    },
  ]);
