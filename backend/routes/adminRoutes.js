import express from "express";

import {
  getAnalytics,
  getFunnel,
  getCategoryDemand,
  getFacultyActivity,
  getStudentEngagement,
  getOpportunities,
  getApplications,
  getActivityTrend,
  getFaculty,
  getFacultyDetail,
  getStudents,
  getStudentYearCounts,
  getStudentBranches,
  getPendingFaculty,
  approveFaculty,
  rejectFaculty,
  banUser,
  unbanUser,
  removeUser,
} from "../controllers/adminController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import requireActiveAccount from "../middleware/requireActiveAccount.js";
import validate from "../middleware/validateMiddleware.js";
import { validateObjectId } from "../utils/validateObjectId.js";
import { facultyActionLimiter } from "../middleware/rateLimiters.js";
import {
  rejectFacultyValidation,
  banUserValidation,
  removeUserValidation,
  funnelQueryValidation,
  opportunitiesListQueryValidation,
  applicationsListQueryValidation,
  activityTrendQueryValidation,
  facultyActivityQueryValidation,
  studentEngagementQueryValidation,
  studentsListQueryValidation,
  studentYearCountsQueryValidation,
} from "../validators/adminValidator.js";

const router = express.Router();

// Every admin route requires an active coordinator.
router.use(authMiddleware, authorizeRoles("Coordinator"), requireActiveAccount);

// Org-scoped analytics for the coordinator dashboard.
router.get("/analytics", getAnalytics);

// Every query param below is validated against an explicit allow-list
// (Joi .valid(...)) before it can reach an aggregation pipeline — see the
// comment on the analytics query validators in adminValidator.js.
router.get(
  "/analytics/funnel",
  validate(funnelQueryValidation, "query"),
  getFunnel
);
router.get("/analytics/category-demand", getCategoryDemand);
router.get(
  "/analytics/faculty-activity",
  validate(facultyActivityQueryValidation, "query"),
  getFacultyActivity
);
router.get(
  "/analytics/student-engagement",
  validate(studentEngagementQueryValidation, "query"),
  getStudentEngagement
);
router.get(
  "/analytics/trend",
  validate(activityTrendQueryValidation, "query"),
  getActivityTrend
);

// The organization's full opportunity listing, for the Opportunities tab.
router.get(
  "/opportunities",
  validate(opportunitiesListQueryValidation, "query"),
  getOpportunities
);

// The organization's cross-opportunity applications queue, for the
// Applications tab and the Total Applications / "awaiting first review"
// drill-downs on Overview.
router.get(
  "/applications",
  validate(applicationsListQueryValidation, "query"),
  getApplications
);

// People directory for the coordinator's organization.
router.get("/faculty", getFaculty);
router.get(
  "/students",
  validate(studentsListQueryValidation, "query"),
  getStudents
);
router.get(
  "/students/year-counts",
  validate(studentYearCountsQueryValidation, "query"),
  getStudentYearCounts
);
// No query params — nothing to validate.
router.get("/students/branches", getStudentBranches);

// Faculty awaiting approval in the coordinator's organization.
router.get("/faculty/pending", getPendingFaculty);

// Registered after /faculty/pending deliberately — Express matches routes in
// registration order, and "pending" would otherwise be swallowed by :id.
router.get("/faculty/:id", validateObjectId("id"), getFacultyDetail);

router.patch("/faculty/:id/approve", validateObjectId("id"), approveFaculty);

router.patch(
  "/faculty/:id/reject",
  validateObjectId("id"),
  validate(rejectFacultyValidation),
  rejectFaculty
);

// Account moderation — ban / unban / remove a Student or Faculty account in
// the coordinator's own organization. Rate-limited with the same
// facultyActionLimiter used for other consequential mutations, so a
// compromised coordinator account can't be used to mass-moderate an
// institution's users unboundedly.

router.patch(
  "/users/:id/ban",
  facultyActionLimiter,
  validateObjectId("id"),
  validate(banUserValidation),
  banUser
);

router.patch(
  "/users/:id/unban",
  facultyActionLimiter,
  validateObjectId("id"),
  unbanUser
);

router.delete(
  "/users/:id",
  facultyActionLimiter,
  validateObjectId("id"),
  validate(removeUserValidation),
  removeUser
);

export default router;
