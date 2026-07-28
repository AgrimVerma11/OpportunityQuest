import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import { ROLES, ACCOUNT_STATUS } from "../constants/userConstants.js";

dotenv.config();

// Provisions a coordinator for an existing organization. Coordinators are not
// self-registered — they are created here by an operator, which is the trust
// anchor for the whole approval chain (a coordinator then approves faculty).
//
//   COORD_NAME="Neha Gupta" COORD_EMAIL="coordinator@thapar.edu" \
//     COORD_PASSWORD="a-strong-password" node scripts/provisionCoordinator.js
//
// The organization is resolved from the email's domain and must already exist.

async function run() {
  const name = process.env.COORD_NAME;
  const email = (process.env.COORD_EMAIL || "").toLowerCase().trim();
  const password = process.env.COORD_PASSWORD;

  if (!name || !email || !password) {
    console.error(
      "Set COORD_NAME, COORD_EMAIL and COORD_PASSWORD in the environment."
    );
    process.exit(1);
  }

  await connectDB();

  const domain = email.split("@")[1];
  const organization = await Organization.findOne({ emailDomains: domain });
  if (!organization) {
    console.error(
      `No organization owns the domain "${domain}". Create it first.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    console.error(`A user with ${email} already exists; not overwriting it.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const coordinator = await User.create({
    organizationId: organization._id,
    name,
    email,
    password: passwordHash,
    role: ROLES.COORDINATOR,
    gender: "Other",
    accountStatus: ACCOUNT_STATUS.ACTIVE,
  });

  console.log(
    `Coordinator provisioned: ${coordinator.email} for ${organization.name}`
  );
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Provisioning failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
