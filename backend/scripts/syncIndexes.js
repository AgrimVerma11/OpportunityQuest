import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import Opportunity from "../models/Opportunity.js";
import Application from "../models/Application.js";
import AuditLog from "../models/AuditLog.js";

dotenv.config();

// Reconciles the indexes in the database with the ones declared on the schemas.
// Mongoose auto-creates missing indexes but never DROPS ones you removed from a
// schema, so after right-sizing the indexes the database still carries the old
// ones until this runs. syncIndexes() creates what's missing and drops what's
// no longer declared, per model.
//
//   node scripts/syncIndexes.js
//
// Safe and idempotent — it only alters indexes, never documents — but index
// builds lock/consume resources on a large collection, so run it in a quiet
// window in production. Refuses to run in production without CONFIRM_MIGRATION=1.

const MODELS = [Organization, User, Opportunity, Application, AuditLog];

async function run() {
  if (process.env.NODE_ENV === "production" && !process.env.CONFIRM_MIGRATION) {
    console.error(
      "Refusing to run in production without CONFIRM_MIGRATION=1 set."
    );
    process.exit(1);
  }

  await connectDB();

  for (const Model of MODELS) {
    // syncIndexes returns the names of indexes it dropped.
    const dropped = await Model.syncIndexes();
    const current = (await Model.collection.indexes()).map((i) => i.name);
    console.log(
      `${Model.modelName}: dropped [${dropped.join(", ") || "none"}]; ` +
        `now [${current.join(", ")}]`
    );
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Index sync failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
