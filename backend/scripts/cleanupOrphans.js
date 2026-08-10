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

dotenv.config();

// Sweeps records left dangling when a user (or opportunity) was removed directly
// in the database, bypassing the app's cascade — the state that made deleted
// people show up as "Unknown"/"Student" and still be messageable. Safe to
// re-run; deletes only records whose REQUIRED references no longer resolve.
//
//   node scripts/cleanupOrphans.js
//
// Going forward, delete users with scripts/deleteUser.js instead of by hand, so
// this never needs running again.

const idSet = (docs) => new Set(docs.map((d) => d._id.toString()));

async function run() {
  await connectDB();

  const liveUsers = idSet(await User.find({}, "_id"));

  // 1) Opportunities whose poster is gone.
  const deadOpps = (await Opportunity.find({}, "_id postedBy")).filter(
    (o) => !liveUsers.has(o.postedBy?.toString())
  );
  if (deadOpps.length) {
    await Opportunity.deleteMany({ _id: { $in: deadOpps.map((o) => o._id) } });
  }
  const liveOpps = idSet(await Opportunity.find({}, "_id"));

  // 2) Applications whose student or opportunity is gone (also removes the
  //    stored resume file).
  const deadApps = (
    await Application.find({}, "_id student opportunity resume")
  ).filter(
    (a) =>
      !liveUsers.has(a.student?.toString()) ||
      !liveOpps.has(a.opportunity?.toString())
  );
  for (const a of deadApps) {
    if (a.resume?.key) await storage.remove(a.resume.key).catch(() => {});
  }
  if (deadApps.length) {
    await Application.deleteMany({ _id: { $in: deadApps.map((a) => a._id) } });
  }
  const liveApps = idSet(await Application.find({}, "_id"));

  // 3) Conversations missing a participant, application or opportunity.
  const deadConvos = (
    await Conversation.find({}, "_id student faculty application opportunity")
  ).filter(
    (c) =>
      !liveUsers.has(c.student?.toString()) ||
      !liveUsers.has(c.faculty?.toString()) ||
      !liveApps.has(c.application?.toString()) ||
      !liveOpps.has(c.opportunity?.toString())
  );
  if (deadConvos.length) {
    await Conversation.deleteMany({
      _id: { $in: deadConvos.map((c) => c._id) },
    });
  }
  const liveConvos = idSet(await Conversation.find({}, "_id"));

  // 4) Messages whose conversation is gone.
  const deadMsgs = (await Message.find({}, "_id conversationId")).filter(
    (m) => !liveConvos.has(m.conversationId?.toString())
  );
  if (deadMsgs.length) {
    await Message.deleteMany({ _id: { $in: deadMsgs.map((m) => m._id) } });
  }

  // 5) Notifications whose recipient is gone.
  const deadNotifs = (await Notification.find({}, "_id recipient")).filter(
    (n) => !liveUsers.has(n.recipient?.toString())
  );
  if (deadNotifs.length) {
    await Notification.deleteMany({
      _id: { $in: deadNotifs.map((n) => n._id) },
    });
  }

  console.log("Orphan cleanup complete. Removed:");
  console.log(`  opportunities: ${deadOpps.length}`);
  console.log(`  applications:  ${deadApps.length}`);
  console.log(`  conversations: ${deadConvos.length}`);
  console.log(`  messages:      ${deadMsgs.length}`);
  console.log(`  notifications: ${deadNotifs.length}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Cleanup failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
