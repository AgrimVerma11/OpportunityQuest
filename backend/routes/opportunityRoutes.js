import express from "express";

import {
  createOpportunity,
  getOpportunities,
} from "../controllers/opportunityController.js";

import authMiddleware from "../middleware/authMiddleware.js";

import authorizeRoles from "../middleware/authorizeRoles.js";

import validate from "../middleware/validateMiddleware.js";

import {
  createOpportunityValidation,
} from "../validators/opportunityValidator.js";

import Opportunity from "../models/Opportunity.js";

const router = express.Router();




// CREATE OPPORTUNITY


router.post(

  "/create",

  authMiddleware,

  authorizeRoles("Faculty"),

  validate(createOpportunityValidation),

  createOpportunity
);




// GET OPPORTUNITIES


router.get(
  "/",
  getOpportunities
);



// CATEGORY STATS


router.get(
  "/stats/categories",

  async (req, res) => {

    try {

      const stats =
        await Opportunity.aggregate([

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

        success: false,

        message:
          "Failed to generate category stats",

      });

    }
  }
);



export default router;