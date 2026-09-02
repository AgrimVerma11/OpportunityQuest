import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import User from "../models/User.js";
import { cascadeDeleteUser } from "../services/userService.js";

dotenv.config();

// The proper way to remove a user — do NOT delete the User document directly in
// the database, which orphans their applications, conversations, messages and
// notifications (leaving "Unknown"/"Student" ghosts that are still actionable).
//
//   USER_EMAIL="someone@thapar.edu" node scripts/deleteUser.js
//
// A thin CLI wrapper: the actual cascade lives in services/userService.js's
// cascadeDeleteUser, shared with the coordinator-facing "remove account"
// endpoint (adminService.removeUser) so the logic is implemented once.

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

  const { removed, countersFixed } = await cascadeDeleteUser(user._id);

  console.log(`Deleted ${email} (${user.role}) and their footprint:`);
  console.log({ ...removed, countersFixed });

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Delete failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
