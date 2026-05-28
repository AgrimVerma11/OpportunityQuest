import Opportunity from "../models/Opportunity.js";



// =========================
// CREATE OPPORTUNITY
// =========================

export const createOpportunity = async (req, res) => {

  try {

    const {
      title,
      description,
      category,
      eligibleBranches,
      eligibleYears,
      eligibleGender,
      contactEmail,
      tags,
      deadline,
    } = req.body;

    console.log("Incoming Opportunity:", req.body);

    const opportunity = await Opportunity.create({

      title,

      description,

      category,

      postedBy: req.user.id,

      eligibleBranches:
        eligibleBranches?.length
          ? eligibleBranches
          : ["All"],

      eligibleYears:
        eligibleYears?.length
          ? eligibleYears
          : ["All"],

      eligibleGender,

      contactEmail,

      tags:
        tags?.filter((tag) => tag.trim() !== "") || [],

      deadline,

    });

    res.status(201).json({
      success: true,
      message: "Opportunity created successfully",
      opportunity,
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Server error",
    });

  }
};



// =========================
// GET ALL OPPORTUNITIES
// =========================

export const getOpportunities = async (req, res) => {

  try {

    const opportunities =
      await Opportunity.find({
        status: "Active",
      })

      .populate("postedBy", "name role")

      .sort({
        createdAt: -1,
      });

    res.json(opportunities);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Server error",
    });

  }
};



// =========================
// ARCHIVE OPPORTUNITY
// =========================

export const archiveOpportunity = async (req, res) => {

  try {

    const { id } = req.params;

    const opportunity =
      await Opportunity.findById(id);

    if (!opportunity) {

      return res.status(404).json({
        message: "Opportunity not found",
      });

    }

    // owner check
    if (
      opportunity.postedBy.toString() !==
      req.user.id
    ) {

      return res.status(403).json({
        message: "Unauthorized",
      });

    }

    opportunity.status = "Closed";

    await opportunity.save();

    res.json({
      success: true,
      message: "Opportunity archived",
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Server error",
    });

  }
};