import * as adminService from "../services/adminService.js";
import { respondError } from "../utils/respondError.js";

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
