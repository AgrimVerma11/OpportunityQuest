import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import User from "../models/User.js";
import Opportunity from "../models/Opportunity.js";
import Application from "../models/Application.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import * as storage from "../lib/storage/index.js";
import { reconcileApplicationCounts } from "./reconcile.js";

dotenv.config();

// The proper way to remove a user — do NOT delete the User document directly in
// the database, which orphans their applications, conversations, messages and
// notifications (leaving "Unknown"/"Student" ghosts that are still actionable).
//
//   USER_EMAIL="someone@thapar.edu" node scripts/deleteUser.js
//
// Cascades the user's whole footprint:
//   - opportunities they posted, and every application/conversation/message on them
//   - their own applications (as a student), with stored resumes removed
//   - conversations they participate in, with their messages
//   - notifications addressed to them
// Audit-log entries are intentionally kept (they are an immutable record).

async function run() {
  const email = (process.env.USER_EMAIL || "").toLowerCase().trim();
  if (!email) {
    console.error("Set USER_EMAIL in the environment.");
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`No user with ${email}.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const userId = user._id;

  // Opportunities this user posted.
  const oppIds = (await Opportunity.find({ postedBy: userId }, "_id")).map(
    (o) => o._id
  );

  // Applications: the user's own + any made to their opportunities.
  const apps = await Application.find(
    { $or: [{ student: userId }, { opportunity: { $in: oppIds } }] },
    "_id resume"
  );
  for (const a of apps) {
    if (a.resume?.key) await storage.remove(a.resume.key).catch(() => {});
  }
  const appIds = apps.map((a) => a._id);

  // Conversations the user is in, or that hang off their opportunities/apps.
  const convoIds = (
    await Conversation.find(
      {
        $or: [
          { student: userId },
          { faculty: userId },
          { opportunity: { $in: oppIds } },
          { application: { $in: appIds } },
        ],
      },
      "_id"
    )
  ).map((c) => c._id);

  const removed = {
    messages: (
      await Message.deleteMany({ conversationId: { $in: convoIds } })
    ).deletedCount,
    conversations: (
      await Conversation.deleteMany({ _id: { $in: convoIds } })
    ).deletedCount,
    applications: (
      await Application.deleteMany({ _id: { $in: appIds } })
    ).deletedCount,
    opportunities: (
      await Opportunity.deleteMany({ _id: { $in: oppIds } })
    ).deletedCount,
    notifications: (
      await Notification.deleteMany({ recipient: userId })
    ).deletedCount,
  };

  // Their avatar in storage, if any.
  if (user.profileImage) {
    const key = storage.keyFromPublicUrl?.(user.profileImage);
    if (key) await storage.remove(key).catch(() => {});
  }

  await User.deleteOne({ _id: userId });

  // Heal Opportunity.applicationsCount on any surviving opportunity this user
  // had applied to (its counter was just decremented out-of-band).
  const countersFixed = await reconcileApplicationCounts();

  console.log(`Deleted ${email} (${user.role}) and their footprint:`);
  console.log({ ...removed, countersFixed });

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Delete failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
