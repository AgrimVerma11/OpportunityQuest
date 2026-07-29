import mongoose from "mongoose";
import { AUDIT_ACTION_VALUES } from "../constants/auditConstants.js";

// An append-only record of consequential administrative actions. It is history,
// not state: the affected resource (e.g. a user's accountStatus) remains the
// single source of truth for access. This collection exists to answer "who did
// what, to whom, when, and why" — permanently, even after the current state has
// moved on. Nothing in the application updates or deletes these rows.
const auditLogSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    // Who performed the action.
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: AUDIT_ACTION_VALUES,
      required: true,
    },
    // Who (or what) the action was taken on. Optional so the vocabulary can
    // extend to actions that do not target a user, but set for every action today.
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
  },
  // Append-only: a creation time is meaningful, an update time is not.
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The trail is read per organization, most-recent first.
auditLogSchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
