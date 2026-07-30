import mongoose from "mongoose";
import { NOTIFICATION_TYPE_VALUES } from "../constants/notificationConstants.js";

// An in-app notification addressed to one user. It is the record of "something
// happened that concerns you"; an optional email nudge (decided by type) is a
// convenience layered on top, not stored here. Unlike the audit log, these are
// user-facing and mutable — being read flips a flag.
const notificationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    // Who sees this notification.
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPE_VALUES,
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    // An in-app path the notification links to, e.g. "/my-applications".
    link: { type: String, default: "" },
    // Who or what triggered it (optional context).
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

// A recipient's feed, newest first.
notificationSchema.index({ recipient: 1, createdAt: -1 });
// The unread-count badge, polled often.
notificationSchema.index({ recipient: 1, read: 1 });

export default mongoose.model("Notification", notificationSchema);
