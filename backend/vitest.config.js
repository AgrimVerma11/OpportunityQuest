import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    // The first mongodb-memory-server run downloads a MongoDB binary, which can
    // be slow on a cold CI cache — give the hooks room.
    testTimeout: 30000,
    hookTimeout: 120000,
    // Tests share a single in-memory database; run files serially so they don't
    // race on the same collections.
    fileParallelism: false,
  },
});
