import mongoose from "mongoose";

import * as userRepo from "../repositories/userRepository.js";
import * as auditRepo from "../repositories/auditRepository.js";
import * as emailService from "./emailService.js";
import { cascadeDeleteUser } from "./userService.js";
import { AppError } from "../utils/AppError.js";
import { ROLES, ACCOUNT_STATUS } from "../constants/userConstants.js";
import { AUDIT_ACTIONS } from "../constants/auditConstants.js";

// Roles a coordinator may ban, unban or remove through this service.
// Deliberately excludes Coordinator and SuperAdmin — a peer coordinator is a
// bigger governance question than this feature covers, and a coordinator must
// never be able to act on themselves or another coordinator here, even by
// mistake.
const MODERATABLE_ROLES = [ROLES.STUDENT, ROLES.FACULTY];

// Service — coordinator actions on the faculty of their own organization.

export const listPendingFaculty = (organizationId) =>
  userRepo.findPendingFacultyByOrg(organizationId);

// The coordinator's people directory.
export const listFaculty = (organizationId) =>
  userRepo.findFacultyByOrg(organizationId);

export const listStudents = (organizationId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  return userRepo.findStudentsByOrg(organizationId, { page, limit });
};

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

// ── Account moderation: ban / unban / remove ────────────────────────
//
// Suspended already exists as a real, enforced account-status value — login
// (assertCanSignIn) and every state-changing route (requireActiveAccount)
// already block it. This section is what finally gives a coordinator a safe,
// audited way to set and clear it, plus a proper (cascading) way to remove an
// account entirely, instead of that status sitting unreachable and instead of
// a hand-deleted user leaving orphaned data behind.

// Asserts a loaded account is eligible to be banned/unbanned/removed by this
// coordinator: it exists in their org (findByIdInOrg already scopes that),
// it's a Student or Faculty (never a peer Coordinator/SuperAdmin), and it
// isn't the coordinator's own account. Anything outside the org already reads
// as not-found via findByIdInOrg; the rest are explicit, independent checks —
// defense in depth, not reliant on any single guard alone.
const assertModerationTarget = (target, actorId) => {
  if (!target) {
    throw new AppError("Account not found", 404);
  }
  if (target._id.toString() === actorId) {
    throw new AppError("You cannot take this action on your own account", 400);
  }
  if (!MODERATABLE_ROLES.includes(target.role)) {
    throw new AppError(
      "This action is not available for this account type",
      400
    );
  }
};

// Ban and unban share the exact same shape as decideFaculty above: the status
// change and the audit entry (with a name/email snapshot, so the trail reads
// correctly even if the account is later removed) are written in one
// transaction — either both happen or neither does — and the target is
// re-read inside the transaction so a concurrent action can't slip past the
// eligibility check.
const decideModeration = async ({
  targetId,
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
      const target = await userRepo.findByIdInOrg(
        targetId,
        organizationId,
        session
      );
      assertModerationTarget(target, coordinatorId);

      if (
        action === AUDIT_ACTIONS.USER_BANNED &&
        target.accountStatus !== ACCOUNT_STATUS.ACTIVE
      ) {
        throw new AppError("Only an active account can be suspended", 400);
      }
      if (
        action === AUDIT_ACTIONS.USER_UNBANNED &&
        target.accountStatus !== ACCOUNT_STATUS.SUSPENDED
      ) {
        throw new AppError("This account is not currently suspended", 400);
      }

      updated = await userRepo.setAccountStatus(
        targetId,
        { accountStatus: status },
        session
      );

      await auditRepo.record(
        {
          organizationId,
          actor: coordinatorId,
          action,
          targetUser: targetId,
          targetName: target.name,
          targetEmail: target.email,
          reason,
        },
        session
      );
    });

    // After the decision has committed, fire-and-forget — same discipline as
    // decideFaculty: an email is a side effect, never a reason to fail or
    // delay the response.
    if (action === AUDIT_ACTIONS.USER_BANNED) {
      emailService.notifyAccountBanned(updated, reason);
    } else {
      emailService.notifyAccountUnbanned(updated);
    }

    return updated;
  } finally {
    await session.endSession();
  }
};

export const banUser = (targetId, coordinatorId, organizationId, reason) =>
  decideModeration({
    targetId,
    coordinatorId,
    organizationId,
    status: ACCOUNT_STATUS.SUSPENDED,
    action: AUDIT_ACTIONS.USER_BANNED,
    reason: reason || "",
  });

export const unbanUser = (targetId, coordinatorId, organizationId) =>
  decideModeration({
    targetId,
    coordinatorId,
    organizationId,
    status: ACCOUNT_STATUS.ACTIVE,
    action: AUDIT_ACTIONS.USER_UNBANNED,
  });

// Removal is irreversible and touches six collections, so — unlike ban/unban —
// it is not attempted as a single transaction (the same, already-proven,
// non-transactional shape scripts/deleteUser.js has always used). Instead the
// audit entry is written FIRST, before any destructive step, capturing the
// decision, its reason, and a snapshot of who was targeted. That ordering is
// deliberate: even if the cascade fails partway through, there is still a
// durable, permanent record of what was decided and why, to guide a retry or
// manual follow-up — the audit trail is the one thing here that must never be
// lost.
export const removeUser = async (targetId, coordinatorId, organizationId, reason) => {
  const target = await userRepo.findByIdInOrg(targetId, organizationId);
  assertModerationTarget(target, coordinatorId);

  const targetName = target.name;
  const targetEmail = target.email;

  await auditRepo.record({
    organizationId,
    actor: coordinatorId,
    action: AUDIT_ACTIONS.USER_DELETED,
    targetUser: targetId,
    targetName,
    targetEmail,
    reason: reason || "",
  });

  const { removed, countersFixed } = await cascadeDeleteUser(targetId);

  // Captured before deletion — nothing here needs the (now-gone) User document.
  emailService.notifyAccountRemoved({ name: targetName, email: targetEmail });

  return { removed, countersFixed };
};
