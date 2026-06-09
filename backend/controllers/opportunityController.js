import Opportunity from "../models/Opportunity.js";
import fs from "fs";
import path from "path";


// CREATE OPPORTUNITY

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

    const opportunity = await Opportunity.create({
      title,
      description,
      category,
      postedBy: req.user.id,
      eligibleBranches: eligibleBranches?.length ? eligibleBranches : ["All"],
      eligibleYears: eligibleYears?.length ? eligibleYears : ["All"],
      eligibleGender,
      contactEmail,
      tags: tags?.filter((tag) => tag.trim() !== "") || [],
      deadline,
    });

    res.status(201).json({
      success: true,
      message: "Opportunity created successfully",
      opportunity,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// GET ALL OPPORTUNITIES (public feed — active, not expired, not deleted)

export const getOpportunities = async (req, res) => {
  try {
    const opportunities = await Opportunity.find({
      status: "Active",
      deadline: { $gt: new Date() },
      isDeleted: { $ne: true },
    })
      .populate("postedBy", "name role department")
      .sort({ createdAt: -1 });

    res.json(opportunities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// GET MY OPPORTUNITIES

export const getMyOpportunities = async (req, res) => {
  try {
    const opportunities = await Opportunity.find({
      postedBy: req.user.id,
      isDeleted: { $ne: true },
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: opportunities.length,
      opportunities,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch opportunities" });
  }
};


// GET SINGLE OPPORTUNITY

export const getOpportunityById = async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id).populate(
      "postedBy",
      "name role department"
    );

    if (!opportunity || opportunity.isDeleted) {
      return res.status(404).json({ success: false, message: "Opportunity not found" });
    }

    res.status(200).json({ success: true, opportunity });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// UPDATE OPPORTUNITY

export const updateOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const opportunity = await Opportunity.findById(id);

    if (!opportunity || opportunity.isDeleted) {
      return res.status(404).json({ success: false, message: "Opportunity not found" });
    }

    if (opportunity.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Only update fields that were actually sent
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([, v]) => v !== undefined)
    );

    const updated = await Opportunity.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({ success: true, message: "Opportunity updated", opportunity: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// SOFT DELETE OPPORTUNITY

export const softDeleteOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const opportunity = await Opportunity.findById(id);

    if (!opportunity || opportunity.isDeleted) {
      return res.status(404).json({ success: false, message: "Opportunity not found" });
    }

    if (opportunity.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    opportunity.isDeleted = true;
    opportunity.deletedAt = new Date();
    await opportunity.save();

    res.json({ success: true, message: "Opportunity deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ARCHIVE OPPORTUNITY

export const archiveOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const opportunity = await Opportunity.findById(id);

    if (!opportunity || opportunity.isDeleted) {
      return res.status(404).json({ success: false, message: "Opportunity not found" });
    }

    if (opportunity.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    opportunity.status = "Closed";
    await opportunity.save();

    res.json({ success: true, message: "Opportunity archived" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// EXTEND DEADLINE

export const extendDeadline = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDeadline, reason } = req.body;

    const opportunity = await Opportunity.findById(id);

    if (!opportunity || opportunity.isDeleted) {
      return res.status(404).json({ success: false, message: "Opportunity not found" });
    }

    if (opportunity.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (new Date(newDeadline) <= new Date(opportunity.deadline)) {
      return res.status(400).json({
        success: false,
        message: "New deadline must be later than the current deadline",
      });
    }

    opportunity.deadlineHistory.push({
      previousDeadline: opportunity.deadline,
      extendedAt: new Date(),
      reason: reason || "",
    });

    opportunity.deadline = newDeadline;
    await opportunity.save();

    res.json({ success: true, message: "Deadline extended successfully", opportunity });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// UPLOAD PDF ATTACHMENT

export const uploadAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const opportunity = await Opportunity.findById(id);

    if (!opportunity || opportunity.isDeleted) {
      return res.status(404).json({ success: false, message: "Opportunity not found" });
    }

    if (opportunity.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    opportunity.attachments.push({
      originalName: req.file.originalname,
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
      uploadedAt: new Date(),
    });

    await opportunity.save();

    const newAttachment = opportunity.attachments[opportunity.attachments.length - 1];

    res.status(201).json({ success: true, attachment: newAttachment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// DELETE ATTACHMENT

export const deleteAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const opportunity = await Opportunity.findById(id);

    if (!opportunity || opportunity.isDeleted) {
      return res.status(404).json({ success: false, message: "Opportunity not found" });
    }

    if (opportunity.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const attachment = opportunity.attachments.id(attachmentId);

    if (!attachment) {
      return res.status(404).json({ success: false, message: "Attachment not found" });
    }

    const filePath = path.join(process.cwd(), "uploads", attachment.filename);
    fs.unlink(filePath, (err) => {
      if (err) console.error("Could not delete file from disk:", err.message);
    });

    opportunity.attachments.pull(attachmentId);
    await opportunity.save();

    res.json({ success: true, message: "Attachment deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
