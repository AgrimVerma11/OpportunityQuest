import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";

import authRoutes from "./routes/authRoutes.js";
import authMiddleware from "./middleware/authMiddleware.js";
import opportunityRoutes from "./routes/opportunityRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import sanitize from "./middleware/sanitizeMiddleware.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimiters.js";

// Builds the configured Express application. Startup concerns — loading the
// environment, connecting to MongoDB and binding a port — live in server.js so
// the app can be exercised in-process against an in-memory database by tests.
export function createApp() {
  const app = express();

  // -------- SECURITY & PARSING MIDDLEWARE --------

  // crossOriginResourcePolicy is relaxed so the frontend (a different origin in
  // dev) can load PDF attachments and avatars from /uploads.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173",
      credentials: true,
    })
  );

  app.use(express.json({ limit: "1mb" }));

  // Strip NoSQL operator keys ($gt, $where, dotted paths) from input.
  app.use(sanitize);

  // Throttle the whole API; auth routes get an additional, stricter limit.
  app.use("/api", apiLimiter);

  // Serve public uploaded files (opportunity PDFs, avatars).
  app.use("/uploads", express.static("uploads"));

  // -------- ROUTES --------

  app.get("/", (req, res) => {
    res.send("Server is working");
  });

  app.get("/api/test", (req, res) => {
    res.json({ message: "Backend is working" });
  });

  // Liveness/readiness probe. Reports the Mongo connection state so a load
  // balancer or uptime check can tell "process up" from "process up, DB down".
  app.get("/api/health", (req, res) => {
    const readyStates = ["disconnected", "connected", "connecting", "disconnecting"];
    const state = mongoose.connection.readyState;
    const dbConnected = state === 1;

    res.status(dbConnected ? 200 : 503).json({
      success: dbConnected,
      status: dbConnected ? "ok" : "degraded",
      db: readyStates[state] ?? "unknown",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/opportunities", opportunityRoutes);
  app.use("/api/applications", applicationRoutes);
  app.use("/api/users", userRoutes);

  // Protected route (JWT smoke test).
  app.get("/api/protected", authMiddleware, (req, res) => {
    res.json({
      message: "Protected route accessed",
      user: req.user,
    });
  });

  // -------- ERROR HANDLER --------

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  });

  return app;
}

export default createApp;
