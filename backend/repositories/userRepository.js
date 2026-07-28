import User from "../models/User.js";
import { ROLES, ACCOUNT_STATUS } from "../constants/userConstants.js";

// User data access used outside the auth flow (e.g. eligibility checks and
// application analytics).

export const findById = (id) => User.findById(id);

// Tenant-scoped lookup — used when a coordinator acts on an account, so one
// organization can never approve another's.
export const findByIdInOrg = (id, organizationId) =>
  User.findOne({ _id: id, organizationId });

export const findPendingFacultyByOrg = (organizationId) =>
  User.find({
    organizationId,
    role: ROLES.FACULTY,
    accountStatus: ACCOUNT_STATUS.PENDING,
  })
    .select("-password")
    .sort({ createdAt: 1 });

export const setAccountStatus = (id, update) =>
  User.findByIdAndUpdate(id, update, { new: true }).select("-password");

export const incrementApplicationsSubmitted = (id, delta) =>
  User.findByIdAndUpdate(id, { $inc: { applicationsSubmitted: delta } });
