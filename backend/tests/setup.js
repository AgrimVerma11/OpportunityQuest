// Global test harness: a throwaway in-memory MongoDB shared by the suite, wiped
// between cases so every test starts from a known-empty state. No external
// database or network is required, which keeps CI hermetic.

process.env.NODE_ENV = "test";
// Tests always use the local storage driver — never reach for cloud storage,
// regardless of what a developer's .env or the CI environment sets.
process.env.STORAGE_DRIVER = "local";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-only-secret-not-used-in-production";

import { afterAll, afterEach, beforeAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// When TEST_MONGO_URI is provided (CI points it at a MongoDB service container)
// we connect to that. Otherwise we spin up a throwaway in-memory instance, so
// local runs stay zero-config. TEST_MONGO_URI is used instead of MONGO_URI on
// purpose, so a developer's real database connection can never be targeted.
let mongod;

beforeAll(async () => {
  const externalUri = process.env.TEST_MONGO_URI;
  if (externalUri) {
    await mongoose.connect(externalUri);
  } else {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }
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
