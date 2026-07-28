import * as opportunityService from "../services/opportunityService.js";
import { respondError as handleError } from "../utils/respondError.js";

// Controller — request handling and response formatting only.
// Business rules live in the service; DB access lives in the repository.

// CREATE OPPORTUNITY
export const createOpportunity = async (req, res) => {
  try {
    const opportunity = await opportunityService.createOpportunity(
      req.body,
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: "Opportunity created successfully",
      opportunity,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// GET ALL OPPORTUNITIES (public feed — active, not expired, not deleted)
export const getOpportunities = async (req, res) => {
  try {
    const opportunities = await opportunityService.getActiveOpportunities();
    res.json({ success: true, opportunities });
  } catch (error) {
    handleError(res, error);
  }
};

// GET MY OPPORTUNITIES
export const getMyOpportunities = async (req, res) => {
  try {
    const opportunities = await opportunityService.getMyOpportunities(
      req.user.id
    );

    res.status(200).json({
      success: true,
      count: opportunities.length,
      opportunities,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// GET SINGLE OPPORTUNITY
export const getOpportunityById = async (req, res) => {
  try {
    const opportunity = await opportunityService.getOpportunityById(
      req.params.id
    );
    res.status(200).json({ success: true, opportunity });
  } catch (error) {
    handleError(res, error);
  }
};

// UPDATE OPPORTUNITY
export const updateOpportunity = async (req, res) => {
  try {
    const opportunity = await opportunityService.updateOpportunity(
      req.params.id,
      req.user.id,
      req.body
    );
    res.json({ success: true, message: "Opportunity updated", opportunity });
  } catch (error) {
    handleError(res, error);
  }
};

// SOFT DELETE OPPORTUNITY
export const softDeleteOpportunity = async (req, res) => {
  try {
    await opportunityService.softDeleteOpportunity(req.params.id, req.user.id);
    res.json({ success: true, message: "Opportunity deleted" });
  } catch (error) {
    handleError(res, error);
  }
};

// ARCHIVE OPPORTUNITY (Active → Archived)
export const archiveOpportunity = async (req, res) => {
  try {
    await opportunityService.archiveOpportunity(req.params.id, req.user.id);
    res.json({ success: true, message: "Opportunity archived" });
  } catch (error) {
    handleError(res, error);
  }
};

// UNARCHIVE OPPORTUNITY (Archived → Active, optional new deadline)
export const unarchiveOpportunity = async (req, res) => {
  try {
    const opportunity = await opportunityService.unarchiveOpportunity(
      req.params.id,
      req.user.id,
      req.body
    );
    res.json({
      success: true,
      message: "Opportunity reactivated",
      opportunity,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// CLOSE OPPORTUNITY (→ Closed, terminal)
export const closeOpportunity = async (req, res) => {
  try {
    await opportunityService.closeOpportunity(req.params.id, req.user.id);
    res.json({ success: true, message: "Opportunity closed" });
  } catch (error) {
    handleError(res, error);
  }
};

// EXTEND DEADLINE
export const extendDeadline = async (req, res) => {
  try {
    const opportunity = await opportunityService.extendDeadline(
      req.params.id,
      req.user.id,
      req.body
    );
    res.json({
      success: true,
      message: "Deadline extended successfully",
      opportunity,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// UPLOAD PDF ATTACHMENT
export const uploadAttachment = async (req, res) => {
  try {
    const attachment = await opportunityService.addAttachment(
      req.params.id,
      req.user.id,
      req.file
    );
    res.status(201).json({ success: true, attachment });
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE ATTACHMENT
export const deleteAttachment = async (req, res) => {
  try {
    await opportunityService.deleteAttachment(
      req.params.id,
      req.user.id,
      req.params.attachmentId
    );
    res.json({ success: true, message: "Attachment deleted" });
  } catch (error) {
    handleError(res, error);
  }
};

// CATEGORY STATS
export const getCategoryStats = async (req, res) => {
  try {
    const stats = await opportunityService.getCategoryStats();
    res.json(stats);
  } catch (error) {
    handleError(res, error);
  }
};
