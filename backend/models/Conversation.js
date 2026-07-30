import mongoose from "mongoose";

// A private thread between the two people attached to one application: the
// student and the faculty member who posted the opportunity. There is exactly
// one conversation per application (unique). The student, faculty and
// opportunity are denormalized here so the inbox can render and authorize
// without extra lookups; whether the thread is open or read-only is NOT stored
// — it is derived from the live application status (single source of truth).
const conversationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      unique: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    opportunity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      required: true,
    },
    opportunityTitle: { type: String, default: "" },
    lastMessageAt: { type: Date },
    lastMessageSnippet: { type: String, default: "" },
    // Per-participant unread counters; the recipient's is bumped on each new
    // message and zeroed when they open the thread.
    unreadStudent: { type: Number, default: 0 },
    unreadFaculty: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Each participant's inbox, most-recently-active first.
conversationSchema.index({ student: 1, lastMessageAt: -1 });
conversationSchema.index({ faculty: 1, lastMessageAt: -1 });

export default mongoose.model("Conversation", conversationSchema);
