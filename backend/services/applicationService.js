import * as applicationRepo from "../repositories/applicationRepository.js";
import * as opportunityRepo from "../repositories/opportunityRepository.js";
import * as userRepo from "../repositories/userRepository.js";
import * as notificationService from "./notificationService.js";
import { AppError } from "../utils/AppError.js";
import * as storage from "../lib/storage/index.js";
import { resumeKey } from "../lib/storage/keys.js";
import {
  APPLICATION_STATUS,
  STATUS_TRANSITIONS,
  WITHDRAWABLE_STATUSES,
  REAPPLY_COOLDOWN_HOURS,
} from "../constants/applicationConstants.js";
import { NOTIFICATION_TYPES } from "../constants/notificationConstants.js";

const COOLDOWN_MS = REAPPLY_COOLDOWN_HOURS * 60 * 60 * 1000;

// Tells the opportunity's owner that a student applied. Awaited but never
// throws (notificationService swallows its own errors), so it can't break the
// application it announces.
const notifyNewApplication = (opportunity, studentId) =>
  notificationService.notify({
    organizationId: opportunity.organizationId,
    recipientId: opportunity.postedBy,
    type: NOTIFICATION_TYPES.APPLICATION_RECEIVED,
    title: "New application",
    body: `A student applied to "${opportunity.title}".`,
    link: `/opportunity/${opportunity._id}/applicants`,
    actor: studentId,
  });

// ── Helpers ──────────────────────────────────────────────────────

// Strict eligibility: branch, year and gender must all match (unless the
// opportunity opens that dimension to "All" / "Any").
const isEligible = (student, opportunity) => {
  const branchOk =
    opportunity.eligibleBranches.includes("All") ||
    (!!student.branch && opportunity.eligibleBranches.includes(student.branch));

  const yearOk =
    opportunity.eligibleYears.includes("All") ||
    (student.year != null &&
      opportunity.eligibleYears.includes(String(student.year)));

  const genderOk =
    opportunity.eligibleGender === "Any" ||
    opportunity.eligibleGender === student.gender;

  return branchOk && yearOk && genderOk;
};

// Persists an uploaded resume to the private storage area and returns the
// subdocument to attach, or null when the applicant supplied no file. The file
// arrives as an in-memory buffer, so nothing is written until the application
// itself is about to be — a rejected application leaves no orphaned object.
const storeResume = async (file) => {
  if (!file) return null;
  const key = resumeKey();
  await storage.put(key, { body: file.buffer, contentType: file.mimetype });
  return { originalName: file.originalname, key, uploadedAt: new Date() };
};

const removeResume = async (key) => {
  if (!key) return;
  try {
    await storage.remove(key);
  } catch (err) {
    console.error("Could not delete resume:", err.message);
  }
};

// Loads an application and asserts the requester may access it:
// the owning student, or the faculty who posted the opportunity.
const loadAuthorizedApplication = async (applicationId, user) => {
  const application = await applicationRepo.findByIdPopulated(applicationId);

  if (!application) {
    throw new AppError("Application not found", 404);
  }

  const isOwningStudent =
    application.student?._id?.toString() === user.id;
  const isOwningFaculty =
    application.opportunity?.postedBy?.toString() === user.id;

  if (!isOwningStudent && !isOwningFaculty) {
    throw new AppError("You are not authorized to view this application", 403);
  }

  return { application, isOwningStudent, isOwningFaculty };
};

// ── Student: apply ───────────────────────────────────────────────

export const applyToOpportunity = async (
  studentId,
  body,
  resumeFile,
  organizationId
) => {
  const opportunity = await opportunityRepo.findById(body.opportunityId);

  // The org check keeps a student from applying to another tenant's
  // opportunity by posting its id directly; it reads as "not found".
  if (
    !opportunity ||
    opportunity.isDeleted ||
    opportunity.organizationId.toString() !== organizationId
  ) {
    throw new AppError("Opportunity not found", 404);
  }

  if (opportunity.status !== "Active") {
    throw new AppError("This opportunity is not accepting applications", 400);
  }

  if (new Date(opportunity.deadline) <= new Date()) {
    throw new AppError("The application deadline has passed", 400);
  }

  const student = await userRepo.findById(studentId);
  if (!student || !isEligible(student, opportunity)) {
    throw new AppError(
      "You do not meet the eligibility criteria for this opportunity",
      403
    );
  }

  const existing = await applicationRepo.findOne({
    student: studentId,
    opportunity: opportunity._id,
  });

  if (existing && existing.status !== APPLICATION_STATUS.WITHDRAWN) {
    throw new AppError("You have already applied to this opportunity", 409);
  }

  if (existing) {
    // Re-apply: enforce the cooldown window before storing anything.
    const elapsed = existing.withdrawnAt
      ? Date.now() - new Date(existing.withdrawnAt).getTime()
      : COOLDOWN_MS;
    if (elapsed < COOLDOWN_MS) {
      const hoursLeft = Math.ceil((COOLDOWN_MS - elapsed) / (60 * 60 * 1000));
      throw new AppError(
        `You can re-apply to this opportunity in about ${hoursLeft} hour(s)`,
        429
      );
    }
  }

  // Every eligibility and duplicate check has passed — persist the resume now.
  const resume = await storeResume(resumeFile);

  if (existing) {
    const previousResumeKey = existing.resume?.key;

    existing.status = APPLICATION_STATUS.APPLIED;
    existing.coverLetter = body.coverLetter;
    if (resume) existing.resume = resume;
    existing.withdrawnAt = null;
    existing.statusHistory.push({
      status: APPLICATION_STATUS.APPLIED,
      changedAt: new Date(),
      changedBy: studentId,
    });

    await applicationRepo.save(existing);
    if (resume && previousResumeKey) await removeResume(previousResumeKey);
    await opportunityRepo.incrementApplicationsCount(opportunity._id, 1);
    await userRepo.incrementApplicationsSubmitted(studentId, 1);
    await notifyNewApplication(opportunity, studentId);
    return existing;
  }

  let application;
  try {
    application = await applicationRepo.create({
      student: studentId,
      opportunity: opportunity._id,
      organizationId: opportunity.organizationId,
      coverLetter: body.coverLetter,
      resume,
      status: APPLICATION_STATUS.APPLIED,
      statusHistory: [
        {
          status: APPLICATION_STATUS.APPLIED,
          changedAt: new Date(),
          changedBy: studentId,
        },
      ],
    });
  } catch (err) {
    if (resume) await removeResume(resume.key);
    // Unique index race: a parallel request already created the application.
    if (err.code === 11000) {
      throw new AppError("You have already applied to this opportunity", 409);
    }
    throw err;
  }

  await opportunityRepo.incrementApplicationsCount(opportunity._id, 1);
  await userRepo.incrementApplicationsSubmitted(studentId, 1);
  await notifyNewApplication(opportunity, studentId);
  return application;
};

// ── Student: my applications ─────────────────────────────────────

export const getMyApplications = (studentId) =>
  applicationRepo.findByStudent(studentId);

// ── Shared: single application (faculty view marks it Viewed) ─────

export const getApplicationForUser = async (applicationId, user) => {
  const { application, isOwningFaculty } = await loadAuthorizedApplication(
    applicationId,
    user
  );

  if (isOwningFaculty && application.status === APPLICATION_STATUS.APPLIED) {
    application.status = APPLICATION_STATUS.VIEWED;
    application.statusHistory.push({
      status: APPLICATION_STATUS.VIEWED,
      changedAt: new Date(),
      changedBy: user.id,
    });
    await applicationRepo.save(application);
  }

  return application;
};

// ── Shared: resume access ────────────────────────────────────────

export const getResumeForUser = async (applicationId, user) => {
  const { application } = await loadAuthorizedApplication(applicationId, user);

  if (!application.resume?.key) {
    throw new AppError("No resume on file for this application", 404);
  }

  const object = await storage.getStream(application.resume.key);
  if (!object) {
    throw new AppError("Resume file is no longer available", 404);
  }

  return { ...object, originalName: application.resume.originalName };
};

// ── Faculty: applicants for an opportunity ───────────────────────

export const getApplicantsForOpportunity = async (
  opportunityId,
  facultyId,
  status
) => {
  const opportunity = await opportunityRepo.findById(opportunityId);

  if (!opportunity || opportunity.isDeleted) {
    throw new AppError("Opportunity not found", 404);
  }

  if (opportunity.postedBy.toString() !== facultyId) {
    throw new AppError(
      "You are not authorized to view these applicants",
      403
    );
  }

  return applicationRepo.findByOpportunity(opportunityId, status);
};

// ── Faculty: update status ───────────────────────────────────────

export const updateApplicationStatus = async (
  applicationId,
  facultyId,
  newStatus
) => {
  const application = await applicationRepo.findById(applicationId);

  if (!application) {
    throw new AppError("Application not found", 404);
  }

  const opportunity = await opportunityRepo.findById(application.opportunity);
  if (!opportunity || opportunity.postedBy.toString() !== facultyId) {
    throw new AppError(
      "You are not authorized to update this application",
      403
    );
  }

  const allowed = STATUS_TRANSITIONS[application.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot change status from ${application.status} to ${newStatus}`,
      400
    );
  }

  application.status = newStatus;
  application.statusHistory.push({
    status: newStatus,
    changedAt: new Date(),
    changedBy: facultyId,
  });

  await applicationRepo.save(application);

  // Tell the student their application moved. Awaited but never throws.
  await notificationService.notify({
    organizationId: application.organizationId,
    recipientId: application.student,
    type: NOTIFICATION_TYPES.APPLICATION_STATUS,
    title: `Application ${newStatus.toLowerCase()}`,
    body: `Your application for "${opportunity.title}" is now ${newStatus}.`,
    link: "/my-applications",
    actor: facultyId,
  });

  return application;
};

// ── Student: withdraw ────────────────────────────────────────────

export const withdrawApplication = async (applicationId, studentId) => {
  const application = await applicationRepo.findById(applicationId);

  if (!application) {
    throw new AppError("Application not found", 404);
  }

  if (application.student.toString() !== studentId) {
    throw new AppError(
      "You are not authorized to withdraw this application",
      403
    );
  }

  if (!WITHDRAWABLE_STATUSES.includes(application.status)) {
    throw new AppError(
      "This application can no longer be withdrawn",
      400
    );
  }

  application.status = APPLICATION_STATUS.WITHDRAWN;
  application.withdrawnAt = new Date();
  application.statusHistory.push({
    status: APPLICATION_STATUS.WITHDRAWN,
    changedAt: new Date(),
    changedBy: studentId,
  });

  await applicationRepo.save(application);
  await opportunityRepo.incrementApplicationsCount(application.opportunity, -1);
  await userRepo.incrementApplicationsSubmitted(studentId, -1);
};
