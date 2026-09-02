import express from "express";

import {
  getAnalytics,
  getFaculty,
  getStudents,
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
} from "../validators/adminValidator.js";

const router = express.Router();

// Every admin route requires an active coordinator.
router.use(authMiddleware, authorizeRoles("Coordinator"), requireActiveAccount);

// Org-scoped analytics for the coordinator dashboard.
router.get("/analytics", getAnalytics);

// People directory for the coordinator's organization.
router.get("/faculty", getFaculty);
router.get("/students", getStudents);

// Faculty awaiting approval in the coordinator's organization.
router.get("/faculty/pending", getPendingFaculty);

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
