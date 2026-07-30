// Global test harness: a throwaway in-memory MongoDB shared by the suite, wiped
// between cases so every test starts from a known-empty state. No external
// database or network is required, which keeps CI hermetic.

process.env.NODE_ENV = "test";
// Tests always use the local storage driver — never reach for cloud storage,
// regardless of what a developer's .env or the CI environment sets.
process.env.STORAGE_DRIVER = "local";
// Likewise, emails are logged, never sent, during tests.
process.env.EMAIL_PROVIDER = "log";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-only-secret-not-used-in-production";

import { afterAll, afterEach, beforeAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// A throwaway in-memory MongoDB. It runs as a single-node REPLICA SET (not a
// standalone) because multi-document transactions — used by the faculty
// approval flow — require one. When TEST_MONGO_URI is provided it is used
// instead, but it too must point at a replica set for the transactional tests
// to pass. TEST_MONGO_URI is deliberately separate from MONGO_URI so a
// developer's real database can never be targeted.
let mongod;

beforeAll(async () => {
  const externalUri = process.env.TEST_MONGO_URI;
  if (externalUri) {
    await mongoose.connect(externalUri);
  } else {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongod.getUri());
  }

  // Absorb the one-time cost of the replica set electing a primary here — a
  // hook with a generous timeout — rather than inside the first test that opens
  // a transaction, where a not-yet-selectable primary can burn the driver's 30s
  // server-selection timeout and fail the run. A trivial transactional write
  // forces the primary to be ready before any test runs.
  const warmup = await mongoose.startSession();
  try {
    await warmup.withTransaction(async () => {
      await mongoose.connection.db
        .collection("__warmup")
        .insertOne({ ok: 1 }, { session: warmup });
    });
  } finally {
    await warmup.endSession();
  }
  await mongoose.connection.db.collection("__warmup").drop().catch(() => {});
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
