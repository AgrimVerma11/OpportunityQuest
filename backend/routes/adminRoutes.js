import express from "express";

import {
  getPendingFaculty,
  approveFaculty,
  rejectFaculty,
} from "../controllers/adminController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import requireActiveAccount from "../middleware/requireActiveAccount.js";
import validate from "../middleware/validateMiddleware.js";
import { validateObjectId } from "../utils/validateObjectId.js";
import { rejectFacultyValidation } from "../validators/adminValidator.js";

const router = express.Router();

// Every admin route requires an active coordinator.
router.use(authMiddleware, authorizeRoles("Coordinator"), requireActiveAccount);

// Faculty awaiting approval in the coordinator's organization.
router.get("/faculty/pending", getPendingFaculty);

router.patch("/faculty/:id/approve", validateObjectId("id"), approveFaculty);

router.patch(
  "/faculty/:id/reject",
  validateObjectId("id"),
  validate(rejectFacultyValidation),
  rejectFaculty
);

export default router;
