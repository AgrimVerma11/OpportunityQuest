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
