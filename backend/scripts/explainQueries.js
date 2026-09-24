import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Organization from "../models/Organization.js";
import Application from "../models/Application.js";
import Opportunity from "../models/Opportunity.js";
import User from "../models/User.js";
import { ROLES } from "../constants/userConstants.js";

dotenv.config();

// Read-only. Runs .explain("executionStats") on the coordinator dashboard's
// heaviest queries against whatever data already exists at MONGO_URI, and
// reports whether each one is actually using an index or falling back to a
// full collection scan. Never writes anything.
//
//   node scripts/explainQueries.js
//
// The report is only meaningful at realistic scale — a handful of documents
// looks fine under any query plan. Point MONGO_URI at a staging database with
// thousands of records (or run scripts/seed.js first) for a signal that
// actually means something.

const since30d = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - 29);
  return d;
};

// Recursively hunts the explain output for a winning-plan stage name —
// COLLSCAN means "read every document", IXSCAN means an index bounded the
// read. A plain string search rather than a strict shape match, since the
// explain schema nests differently (a bare $match/$sort query vs. a full
// aggregation pipeline with $lookup) and this needs to hold up across both.
const stagesIn = (node, found = new Set()) => {
  if (!node || typeof node !== "object") return found;
  if (typeof node.stage === "string") found.add(node.stage);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((v) => stagesIn(v, found));
    else if (value && typeof value === "object") stagesIn(value, found);
  }
  return found;
};

const report = async (label, explainable) => {
  const explain = await explainable.explain("executionStats");
  const stages = stagesIn(explain);
  // COLLSCAN is the one stage that actually means trouble ("read every
  // document"). Everything else — IXSCAN, COUNT_SCAN, IDHACK, DISTINCT_SCAN —
  // means an index bounded the read, so this only needs to name the bad case,
  // not enumerate every acceptable one.
  const verdict = stages.has("COLLSCAN")
    ? "COLLSCAN (full scan — investigate)"
    : stages.size > 0
    ? `no full scan — stages used: [${[...stages].join(", ")}]`
    : "no stages reported (inspect the raw explain output if this looks wrong)";
  console.log(`\n${label}`);
  console.log(`  → ${verdict}`);
};

async function run() {
  await connectDB();

  const [orgCount, oppCount, appCount, userCount] = await Promise.all([
    Organization.countDocuments(),
    Opportunity.countDocuments(),
    Application.countDocuments(),
    User.countDocuments(),
  ]);
  console.log(
    `Data: ${orgCount} orgs, ${userCount} users, ${oppCount} opportunities, ${appCount} applications.`
  );
  if (appCount < 1000) {
    console.log(
      "⚠ Fewer than 1,000 applications — this report won't reflect real-scale query behavior.\n" +
        "  Seed more data (npm run seed, or scripts/backfillOrganizations.js's approach) before trusting it."
    );
  }

  const org = await Organization.findOne();
  if (!org) {
    console.log("\nNo organization found — nothing to explain against.");
    await mongoose.disconnect();
    return;
  }
  const organizationId = org._id;
  console.log(`Explaining against organization: ${org.name} (${organizationId})`);

  // The application funnel's cumulative peak-rank aggregation — mirrors
  // applicationRepository.js's cumulativeFunnelByOrg. Duplicated here (rather
  // than exported for reuse) because that function reshapes its own result
  // before returning and can't be explain()'d directly — keep this pipeline's
  // $match stage in sync with the real one if that ever changes.
  await report(
    "Application funnel ($match by organizationId, then peak-rank $group)",
    Application.aggregate([
      { $match: { organizationId } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ])
  );

  await report(
    "Activity trend — applications/day (organizationId + createdAt range)",
    Application.aggregate([
      { $match: { organizationId, createdAt: { $gte: since30d() } } },
      { $group: { _id: "$__probe", count: { $sum: 1 } } },
    ])
  );

  await report(
    "Activity trend — signups/day (organizationId + createdAt range)",
    User.aggregate([
      {
        $match: {
          organizationId,
          role: { $in: [ROLES.STUDENT, ROLES.FACULTY] },
          createdAt: { $gte: since30d() },
        },
      },
      { $group: { _id: "$__probe", count: { $sum: 1 } } },
    ])
  );

  await report(
    "Faculty activity leaderboard (organizationId + createdAt range)",
    Opportunity.aggregate([
      {
        $match: {
          organizationId,
          isDeleted: { $ne: true },
          createdAt: { $gte: since30d() },
        },
      },
      { $group: { _id: "$postedBy", count: { $sum: 1 } } },
    ])
  );

  await report(
    "Opportunities listing (organizationId, not deleted)",
    Opportunity.find({ organizationId, isDeleted: { $ne: true } }).sort({ createdAt: -1 })
  );

  await report(
    "Students roster, page 1 (organizationId + role)",
    User.find({ organizationId, role: ROLES.STUDENT })
      .sort({ createdAt: -1 })
      .skip(0)
      .limit(20)
  );

  console.log("\nDone.");
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("explainQueries failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
