import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import authMiddleware from "./middleware/authMiddleware.js";
import opportunityRoutes from "./routes/opportunityRoutes.js";



dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.use("/api/opportunities", opportunityRoutes);

// Connect DB
connectDB();

// -------- ROUTES --------

// Basic test
app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

// Test API
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working 🚀" });
});

// Auth routes
app.use("/api/auth", authRoutes);

// 🔐 Protected route (JWT test)
app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({
    message: "Protected route accessed ✅",
    user: req.user,
  });
});

// -------- SERVER --------

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5174;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});