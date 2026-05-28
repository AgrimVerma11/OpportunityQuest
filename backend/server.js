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
app.use(cors());
app.use(express.json());
app.use("/api/opportunities", opportunityRoutes);
// Debug (optional but useful)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

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

const PORT = process.env.PORT || 5174;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});