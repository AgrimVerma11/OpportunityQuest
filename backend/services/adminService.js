import * as userRepo from "../repositories/userRepository.js";
import { AppError } from "../utils/AppError.js";
import { ROLES, ACCOUNT_STATUS } from "../constants/userConstants.js";

// Service — coordinator actions on the faculty of their own organization.

export const listPendingFaculty = (organizationId) =>
  userRepo.findPendingFacultyByOrg(organizationId);

// Loads a faculty account within the coordinator's organization and asserts it
// is currently awaiting approval. Anything outside the org reads as not-found.
const loadPendingFaculty = async (facultyId, organizationId) => {
  const faculty = await userRepo.findByIdInOrg(facultyId, organizationId);

  if (!faculty || faculty.role !== ROLES.FACULTY) {
    throw new AppError("Faculty account not found", 404);
  }
  if (faculty.accountStatus !== ACCOUNT_STATUS.PENDING) {
    throw new AppError("This account is not awaiting approval", 400);
  }

  return faculty;
};

export const approveFaculty = async (facultyId, coordinatorId, organizationId) => {
  await loadPendingFaculty(facultyId, organizationId);

  return userRepo.setAccountStatus(facultyId, {
    accountStatus: ACCOUNT_STATUS.ACTIVE,
    approvedBy: coordinatorId,
    approvedAt: new Date(),
    rejectionReason: "",
  });
};

export const rejectFaculty = async (
  facultyId,
  coordinatorId,
  organizationId,
  reason
) => {
  await loadPendingFaculty(facultyId, organizationId);

  return userRepo.setAccountStatus(facultyId, {
    accountStatus: ACCOUNT_STATUS.REJECTED,
    approvedBy: coordinatorId,
    approvedAt: new Date(),
    rejectionReason: reason || "",
  });
};
