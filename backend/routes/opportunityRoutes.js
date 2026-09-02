import express from "express";
import mongoose from "mongoose";

import {
  createOpportunity,
  getOpportunities,
  getOpportunityById,
  getMyOpportunities,
  archiveOpportunity,
  unarchiveOpportunity,
  closeOpportunity,
  updateOpportunity,
  softDeleteOpportunity,
  extendDeadline,
  uploadAttachment,
  deleteAttachment,
  getCategoryStats,
} from "../controllers/opportunityController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import validate from "../middleware/validateMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";
import { facultyActionLimiter } from "../middleware/rateLimiters.js";

import {
  createOpportunityValidation,
} from "../validators/opportunityValidator.js";

import {
  updateOpportunityValidation,
  extendDeadlineValidation,
  unarchiveValidation,
} from "../validators/updateOpportunityValidator.js";

const router = express.Router();

// Reject a malformed :id / :attachmentId up front so a bad path parameter
// returns a clean 400 instead of surfacing a Mongoose cast error as a 500.
// Guards every route in this router that carries the param.
const rejectInvalidId = (req, res, next, value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid identifier" });
  }
  next();
};
router.param("id", rejectInvalidId);
router.param("attachmentId", rejectInvalidId);




// CREATE OPPORTUNITY

router.post(
  "/create",
  authMiddleware,
  authorizeRoles("Faculty", "Coordinator"),
  facultyActionLimiter,
  validate(createOpportunityValidation),
  createOpportunity
);


// GET ALL OPPORTUNITIES (tenant-scoped feed)

router.get("/", authMiddleware, getOpportunities);


// GET MY OPPORTUNITIES

router.get(
  "/my-opportunities",
  authMiddleware,
  authorizeRoles("Faculty", "Coordinator"),
  getMyOpportunities
);


// CATEGORY STATS

router.get("/stats/categories", authMiddleware, getCategoryStats);


// GET OPPORTUNITY BY ID

router.get("/:id", authMiddleware, getOpportunityById);


// UPDATE OPPORTUNITY

router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("Faculty", "Coordinator"),
  facultyActionLimiter,
  validate(updateOpportunityValidation),
  updateOpportunity
);


// SOFT DELETE OPPORTUNITY

router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("Faculty", "Coordinator"),
  facultyActionLimiter,
  softDeleteOpportunity
);


// ARCHIVE OPPORTUNITY (Active → Archived)

router.patch(
  "/:id/archive",
  authMiddleware,
  authorizeRoles("Faculty", "Coordinator"),
  facultyActionLimiter,
  archiveOpportunity
);


// UNARCHIVE OPPORTUNITY (Archived → Active)

router.patch(
  "/:id/unarchive",
  authMiddleware,
  authorizeRoles("Faculty", "Coordinator"),
  facultyActionLimiter,
  validate(unarchiveValidation),
  unarchiveOpportunity
);


// CLOSE OPPORTUNITY (→ Closed, terminal)

router.patch(
  "/:id/close",
  authMiddleware,
  authorizeRoles("Faculty", "Coordinator"),
  facultyActionLimiter,
  closeOpportunity
);


// EXTEND DEADLINE

router.patch(
  "/:id/extend-deadline",
  authMiddleware,
  authorizeRoles("Faculty", "Coordinator"),
  facultyActionLimiter,
  validate(extendDeadlineValidation),
  extendDeadline
);


// UPLOAD PDF ATTACHMENT

router.post(
  "/:id/attachments",
  authMiddleware,
  authorizeRoles("Faculty", "Coordinator"),
  facultyActionLimiter,
  (req, res, next) => {
    upload.single("attachment")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  uploadAttachment
);


// DELETE ATTACHMENT

router.delete(
  "/:id/attachments/:attachmentId",
  authMiddleware,
  authorizeRoles("Faculty", "Coordinator"),
  facultyActionLimiter,
  deleteAttachment
);


export default router;
