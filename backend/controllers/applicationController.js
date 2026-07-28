import * as applicationService from "../services/applicationService.js";
import { respondError } from "../utils/respondError.js";

// Controller — request handling and response formatting only.

// POST /api/applications  (Student)
export const apply = async (req, res) => {
  try {
    const application = await applicationService.applyToOpportunity(
      req.user.id,
      req.body,
      req.file,
      req.user.organizationId
    );
    res.status(201).json({
      success: true,
      message: "Application submitted",
      application,
    });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/applications/mine  (Student)
export const getMyApplications = async (req, res) => {
  try {
    const applications = await applicationService.getMyApplications(
      req.user.id
    );
    res.json({ success: true, count: applications.length, applications });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/applications/opportunity/:opportunityId  (Faculty owner)
export const getApplicants = async (req, res) => {
  try {
    const applications = await applicationService.getApplicantsForOpportunity(
      req.params.opportunityId,
      req.user.id,
      req.query.status
    );
    res.json({ success: true, count: applications.length, applications });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/applications/:id  (owning student or faculty)
export const getApplication = async (req, res) => {
  try {
    const application = await applicationService.getApplicationForUser(
      req.params.id,
      req.user
    );
    res.json({ success: true, application });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/applications/:id/resume  (owning student or faculty)
export const getResume = async (req, res) => {
  try {
    const { filePath, originalName } =
      await applicationService.getResumeForUser(req.params.id, req.user);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(originalName)}"`
    );
    res.sendFile(filePath);
  } catch (error) {
    respondError(res, error);
  }
};

// PATCH /api/applications/:id/status  (Faculty owner)
export const updateStatus = async (req, res) => {
  try {
    const application = await applicationService.updateApplicationStatus(
      req.params.id,
      req.user.id,
      req.body.status
    );
    res.json({ success: true, message: "Status updated", application });
  } catch (error) {
    respondError(res, error);
  }
};

// PATCH /api/applications/:id/withdraw  (Student owner)
export const withdraw = async (req, res) => {
  try {
    await applicationService.withdrawApplication(req.params.id, req.user.id);
    res.json({ success: true, message: "Application withdrawn" });
  } catch (error) {
    respondError(res, error);
  }
};
