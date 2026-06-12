import express from "express";

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

import {
  createOpportunityValidation,
} from "../validators/opportunityValidator.js";

import {
  updateOpportunityValidation,
  extendDeadlineValidation,
  unarchiveValidation,
} from "../validators/updateOpportunityValidator.js";

const router = express.Router();




// CREATE OPPORTUNITY

router.post(
  "/create",
  authMiddleware,
  authorizeRoles("Faculty"),
  validate(createOpportunityValidation),
  createOpportunity
);


// GET ALL OPPORTUNITIES

router.get("/", getOpportunities);


// GET MY OPPORTUNITIES

router.get(
  "/my-opportunities",
  authMiddleware,
  authorizeRoles("Faculty"),
  getMyOpportunities
);


// CATEGORY STATS

router.get("/stats/categories", getCategoryStats);


// GET OPPORTUNITY BY ID

router.get("/:id", getOpportunityById);


// UPDATE OPPORTUNITY

router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("Faculty"),
  validate(updateOpportunityValidation),
  updateOpportunity
);


// SOFT DELETE OPPORTUNITY

router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("Faculty"),
  softDeleteOpportunity
);


// ARCHIVE OPPORTUNITY (Active → Archived)

router.patch(
  "/:id/archive",
  authMiddleware,
  authorizeRoles("Faculty"),
  archiveOpportunity
);


// UNARCHIVE OPPORTUNITY (Archived → Active)

router.patch(
  "/:id/unarchive",
  authMiddleware,
  authorizeRoles("Faculty"),
  validate(unarchiveValidation),
  unarchiveOpportunity
);


// CLOSE OPPORTUNITY (→ Closed, terminal)

router.patch(
  "/:id/close",
  authMiddleware,
  authorizeRoles("Faculty"),
  closeOpportunity
);


// EXTEND DEADLINE

router.patch(
  "/:id/extend-deadline",
  authMiddleware,
  authorizeRoles("Faculty"),
  validate(extendDeadlineValidation),
  extendDeadline
);


// UPLOAD PDF ATTACHMENT

router.post(
  "/:id/attachments",
  authMiddleware,
  authorizeRoles("Faculty"),
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
  authorizeRoles("Faculty"),
  deleteAttachment
);


export default router;
