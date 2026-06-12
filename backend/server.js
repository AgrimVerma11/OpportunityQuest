import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import authMiddleware from "./middleware/authMiddleware.js";
import opportunityRoutes from "./routes/opportunityRoutes.js";
import sanitize from "./middleware/sanitizeMiddleware.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimiters.js";

dotenv.config();

// Fail fast if critical secrets are missing rather than signing tokens
// with `undefined` (which would silently break auth).
if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not set. Refusing to start.");
  process.exit(1);
}

const app = express();

// -------- SECURITY & PARSING MIDDLEWARE --------

// Security headers. crossOriginResourcePolicy is relaxed so the frontend
// (a different origin in dev) can load PDF attachments from /uploads.
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

// Cap request body size to blunt large-payload abuse.
app.use(express.json({ limit: "1mb" }));

// Strip NoSQL operator keys ($gt, $where, dotted paths) from input.
app.use(sanitize);

// Throttle the whole API; auth routes get an additional, stricter limit.
app.use("/api", apiLimiter);

// Serve uploaded attachments (PDFs).
app.use("/uploads", express.static("uploads"));

// Connect DB
connectDB();

// -------- ROUTES --------

app.get("/", (req, res) => {
  res.send("Server is working");
});

app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working" });
});

app.use("/api/auth", authLimiter, authRoutes);

app.use("/api/opportunities", opportunityRoutes);

// Protected route (JWT test)
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

// -------- SERVER --------

const PORT = process.env.PORT || 5174;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
