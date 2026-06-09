import express from "express";

import {
  createOpportunity,
  getOpportunities,
  getOpportunityById,
  getMyOpportunities,
  archiveOpportunity,
  updateOpportunity,
  softDeleteOpportunity,
  extendDeadline,
  uploadAttachment,
  deleteAttachment,
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
} from "../validators/updateOpportunityValidator.js";

import Opportunity from "../models/Opportunity.js";

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

router.get("/stats/categories", async (_req, res) => {
  try {
    const stats = await Opportunity.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to generate category stats" });
  }
});


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


// ARCHIVE OPPORTUNITY

router.patch(
  "/:id/archive",
  authMiddleware,
  authorizeRoles("Faculty"),
  archiveOpportunity
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
