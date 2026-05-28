import express from "express";

import {
  createOpportunity,
  getOpportunities,
} from "../controllers/opportunityController.js";

import authMiddleware from "../middleware/authMiddleware.js";

import Opportunity from "../models/Opportunity.js";

const router = express.Router();



// =========================
// 🔐 Protected Routes
// =========================

// Create opportunity
router.post("/create", authMiddleware, createOpportunity);



// =========================
// 🌍 Public Routes
// =========================

// Get all opportunities
router.get("/", getOpportunities);



// =========================
// 📊 AGGREGATION ROUTE
// =========================

router.get("/stats/categories", async (req, res) => {

  try {

    const stats = await Opportunity.aggregate([

      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },

      {
        $sort: { count: -1 },
      },

    ]);

    res.json(stats);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Failed to generate category stats",
    });

  }

});



export default router;