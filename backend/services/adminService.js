import mongoose from "mongoose";

import * as userRepo from "../repositories/userRepository.js";
import * as auditRepo from "../repositories/auditRepository.js";
import * as emailService from "./emailService.js";
import { AppError } from "../utils/AppError.js";
import { ROLES, ACCOUNT_STATUS } from "../constants/userConstants.js";
import { AUDIT_ACTIONS } from "../constants/auditConstants.js";

// Service — coordinator actions on the faculty of their own organization.

export const listPendingFaculty = (organizationId) =>
  userRepo.findPendingFacultyByOrg(organizationId);

// Asserts a loaded account is a faculty member of this org still awaiting
// approval. Anything outside the org reads as not-found.
const assertPendingFaculty = (faculty) => {
  if (!faculty || faculty.role !== ROLES.FACULTY) {
    throw new AppError("Faculty account not found", 404);
  }
  if (faculty.accountStatus !== ACCOUNT_STATUS.PENDING) {
    throw new AppError("This account is not awaiting approval", 400);
  }
};

// A coordinator's decision on a pending faculty account. The status change and
// the audit-trail entry are written in one transaction: either the account is
// updated AND the decision is recorded, or neither happens. The account is
// re-read inside the transaction so a concurrent decision cannot slip past the
// pending check.
const decideFaculty = async ({
  facultyId,
  coordinatorId,
  organizationId,
  status,
  action,
  reason = "",
}) => {
  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const faculty = await userRepo.findByIdInOrg(
        facultyId,
        organizationId,
        session
      );
      assertPendingFaculty(faculty);

      updated = await userRepo.setAccountStatus(
        facultyId,
        {
          accountStatus: status,
          approvedBy: coordinatorId,
          approvedAt: new Date(),
          rejectionReason: reason,
        },
        session
      );

      await auditRepo.record(
        {
          organizationId,
          actor: coordinatorId,
          action,
          targetUser: facultyId,
          reason,
        },
        session
      );
    });

    // Tell the faculty member — after the decision has committed, and
    // fire-and-forget: the email is a side effect, never a reason to fail or
    // delay the response. emailService swallows its own errors.
    if (action === AUDIT_ACTIONS.FACULTY_APPROVED) {
      emailService.notifyFacultyApproved(updated);
    } else {
      emailService.notifyFacultyRejected(updated, reason);
    }

    return updated;
  } finally {
    await session.endSession();
  }
};

export const approveFaculty = (facultyId, coordinatorId, organizationId) =>
  decideFaculty({
    facultyId,
    coordinatorId,
    organizationId,
    status: ACCOUNT_STATUS.ACTIVE,
    action: AUDIT_ACTIONS.FACULTY_APPROVED,
  });

export const rejectFaculty = (
  facultyId,
  coordinatorId,
  organizationId,
  reason
) =>
  decideFaculty({
    facultyId,
    coordinatorId,
    organizationId,
    status: ACCOUNT_STATUS.REJECTED,
    action: AUDIT_ACTIONS.FACULTY_REJECTED,
    reason: reason || "",
  });
