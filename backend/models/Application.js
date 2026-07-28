import mongoose from "mongoose";
import {
  APPLICATION_STATUS,
  APPLICATION_STATUSES,
} from "../constants/applicationConstants.js";

// Resume metadata. The file itself lives in private storage (not the public
// uploads mount) and is delivered only through an authorized route.
const resumeSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: APPLICATION_STATUSES, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    opportunity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      required: true,
    },

    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: APPLICATION_STATUS.APPLIED,
    },

    coverLetter: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    resume: {
      type: resumeSchema,
      default: null,
    },

    // Set when the student withdraws; drives the re-apply cooldown.
    withdrawnAt: {
      type: Date,
      default: null,
    },

    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

// A student may hold only one application per opportunity. This makes
// duplicates impossible at the database level (a re-apply reuses the record).
applicationSchema.index({ student: 1, opportunity: 1 }, { unique: true });

// Faculty applicant list, optionally filtered by status.
applicationSchema.index({ opportunity: 1, status: 1 });

// Student "My Applications", newest first.
applicationSchema.index({ student: 1, createdAt: -1 });

export default mongoose.model("Application", applicationSchema);
