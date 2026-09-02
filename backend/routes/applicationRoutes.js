import express from "express";

import {
  apply,
  getMyApplications,
  getApplicants,
  getApplication,
  getResume,
  updateStatus,
  withdraw,
} from "../controllers/applicationController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import validate from "../middleware/validateMiddleware.js";
import { validateObjectId } from "../utils/validateObjectId.js";
import { uploadResume } from "../middleware/uploadResume.js";
import { applyLimiter, facultyActionLimiter } from "../middleware/rateLimiters.js";
import {
  applyValidation,
  statusUpdateValidation,
} from "../validators/applicationValidator.js";

const router = express.Router();

// Parses the optional resume file from a multipart apply request and turns
// multer errors (wrong type / too large) into clean 400s.
const handleResumeUpload = (req, res, next) => {
  uploadResume.single("resume")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// APPLY (Student)
router.post(
  "/",
  authMiddleware,
  authorizeRoles("Student"),
  applyLimiter,
  handleResumeUpload,
  validate(applyValidation),
  apply
);

// MY APPLICATIONS (Student)
router.get(
  "/mine",
  authMiddleware,
  authorizeRoles("Student"),
  getMyApplications
);

// APPLICANTS FOR AN OPPORTUNITY (Faculty owner)
router.get(
  "/opportunity/:opportunityId",
  authMiddleware,
  authorizeRoles("Faculty", "Coordinator"),
  validateObjectId("opportunityId"),
  getApplicants
);

// SINGLE APPLICATION (owning student or faculty)
router.get("/:id", authMiddleware, validateObjectId("id"), getApplication);

// RESUME DOWNLOAD (owning student or faculty)
router.get(
  "/:id/resume",
  authMiddleware,
  validateObjectId("id"),
  getResume
);

// UPDATE STATUS (Faculty owner)
router.patch(
  "/:id/status",
  authMiddleware,
  authorizeRoles("Faculty", "Coordinator"),
  facultyActionLimiter,
  validateObjectId("id"),
  validate(statusUpdateValidation),
  updateStatus
);

// WITHDRAW (Student owner)
router.patch(
  "/:id/withdraw",
  authMiddleware,
  authorizeRoles("Student"),
  validateObjectId("id"),
  withdraw
);

export default router;
