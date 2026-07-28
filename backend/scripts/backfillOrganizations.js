import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import Opportunity from "../models/Opportunity.js";
import Application from "../models/Application.js";

dotenv.config();

// One-time migration for the introduction of multi-tenancy. Ensures a default
// organization exists and stamps every pre-existing user, opportunity and
// application that lacks an organizationId with it. Idempotent: it only touches
// records that are missing the field, so running it twice is harmless.
//
//   node scripts/backfillOrganizations.js
//
// In production it refuses to run unless CONFIRM_MIGRATION=1 is set.

const DEFAULT_ORG = {
  name: "Thapar Institute of Engineering and Technology",
  emailDomains: ["thapar.edu"],
};

async function run() {
  if (process.env.NODE_ENV === "production" && !process.env.CONFIRM_MIGRATION) {
    console.error(
      "Refusing to run in production without CONFIRM_MIGRATION=1 set."
    );
    process.exit(1);
  }

  await connectDB();

  let organization = await Organization.findOne({
    emailDomains: DEFAULT_ORG.emailDomains[0],
  });
  if (!organization) {
    organization = await Organization.create(DEFAULT_ORG);
    console.log(`Created organization "${organization.name}" (${organization._id})`);
  } else {
    console.log(`Using existing organization "${organization.name}" (${organization._id})`);
  }

  const filter = { organizationId: { $exists: false } };
  const update = { $set: { organizationId: organization._id } };

  const [users, opportunities, applications] = await Promise.all([
    User.updateMany(filter, update),
    Opportunity.updateMany(filter, update),
    Application.updateMany(filter, update),
  ]);

  console.log(
    `Backfilled — users: ${users.modifiedCount}, opportunities: ${opportunities.modifiedCount}, applications: ${applications.modifiedCount}`
  );

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Migration failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
