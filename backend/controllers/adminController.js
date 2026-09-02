import * as adminService from "../services/adminService.js";
import * as analyticsService from "../services/analyticsService.js";
import { respondError } from "../utils/respondError.js";

// GET /api/admin/analytics  (Coordinator) — org-scoped dashboard figures.
export const getAnalytics = async (req, res) => {
  try {
    const analytics = await analyticsService.getCoordinatorAnalytics(
      req.user.organizationId
    );
    res.json({ success: true, analytics });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/faculty  (Coordinator) — full faculty roster.
export const getFaculty = async (req, res) => {
  try {
    const faculty = await adminService.listFaculty(req.user.organizationId);
    res.json({ success: true, count: faculty.length, faculty });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/students  (Coordinator) — paginated student roster.
export const getStudents = async (req, res) => {
  try {
    const result = await adminService.listStudents(
      req.user.organizationId,
      req.query
    );
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/faculty/pending  (Coordinator)
export const getPendingFaculty = async (req, res) => {
  try {
    const faculty = await adminService.listPendingFaculty(
      req.user.organizationId
    );
    res.json({ success: true, count: faculty.length, faculty });
  } catch (error) {
    respondError(res, error);
  }
};

// PATCH /api/admin/faculty/:id/approve  (Coordinator)
export const approveFaculty = async (req, res) => {
  try {
    const faculty = await adminService.approveFaculty(
      req.params.id,
      req.user.id,
      req.user.organizationId
    );
    res.json({ success: true, message: "Faculty account approved", faculty });
  } catch (error) {
    respondError(res, error);
  }
};

// PATCH /api/admin/faculty/:id/reject  (Coordinator)
export const rejectFaculty = async (req, res) => {
  try {
    const faculty = await adminService.rejectFaculty(
      req.params.id,
      req.user.id,
      req.user.organizationId,
      req.body.reason
    );
    res.json({ success: true, message: "Faculty account rejected", faculty });
  } catch (error) {
    respondError(res, error);
  }
};

// PATCH /api/admin/users/:id/ban  (Coordinator)
export const banUser = async (req, res) => {
  try {
    const user = await adminService.banUser(
      req.params.id,
      req.user.id,
      req.user.organizationId,
      req.body.reason
    );
    res.json({ success: true, message: "Account suspended", user });
  } catch (error) {
    respondError(res, error);
  }
};

// PATCH /api/admin/users/:id/unban  (Coordinator)
export const unbanUser = async (req, res) => {
  try {
    const user = await adminService.unbanUser(
      req.params.id,
      req.user.id,
      req.user.organizationId
    );
    res.json({ success: true, message: "Account restored", user });
  } catch (error) {
    respondError(res, error);
  }
};

// DELETE /api/admin/users/:id  (Coordinator)
export const removeUser = async (req, res) => {
  try {
    const result = await adminService.removeUser(
      req.params.id,
      req.user.id,
      req.user.organizationId,
      req.body.reason
    );
    res.json({ success: true, message: "Account removed", ...result });
  } catch (error) {
    respondError(res, error);
  }
};
