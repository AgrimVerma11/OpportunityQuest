// Loaded first, as a side-effecting import, so environment variables are in
// place before any other module is evaluated. Some config (e.g. the storage
// driver) is resolved at import time, so a later dotenv.config() would be read
// too late and silently fall back to defaults.
import "dotenv/config";

import mongoose from "mongoose";

import connectDB from "./config/db.js";
import { createApp } from "./app.js";
import logger from "./config/logger.js";
import { initSentry } from "./config/sentry.js";

// Fail fast if critical secrets are missing rather than signing tokens
// with `undefined` (which would silently break auth).
if (!process.env.JWT_SECRET) {
  logger.fatal("JWT_SECRET is not set. Refusing to start.");
  process.exit(1);
}

const sentryActive = initSentry();
logger.info(
  sentryActive
    ? "Sentry error tracking active"
    : "Sentry not configured (SENTRY_DSN unset) — running without error tracking"
);

const app = createApp();

connectDB();

const PORT = process.env.PORT || 5174;

const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info(`Server running on port ${PORT}`);
});

// Render (and most hosts) send SIGTERM before killing a process on redeploy or
// scale-down. Stop accepting new connections, let in-flight requests finish,
// then close the DB connection — rather than dropping requests mid-response
// and leaving Mongo sockets to time out on their own. Capped so a stuck
// connection can never hang a redeploy indefinitely.
const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    await mongoose.disconnect();
    logger.info("Shutdown complete");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
