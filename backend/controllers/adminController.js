import * as adminService from "../services/adminService.js";
import * as analyticsService from "../services/analyticsService.js";
import { respondError } from "../utils/respondError.js";
import logger from "../config/logger.js";

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

// GET /api/admin/analytics/funnel  (Coordinator) — the application funnel,
// optionally scoped to one opportunity category via ?category=.
export const getFunnel = async (req, res) => {
  try {
    const funnel = await analyticsService.getFunnelByCategory(
      req.user.organizationId,
      req.validatedQuery.category
    );
    res.json({ success: true, funnel });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/analytics/category-demand  (Coordinator) — postings vs.
// applications per category.
export const getCategoryDemand = async (req, res) => {
  try {
    const demand = await analyticsService.getCategoryDemand(
      req.user.organizationId
    );
    res.json({ success: true, demand });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/analytics/faculty-activity  (Coordinator) — the faculty
// engagement leaderboard over a Month / Year-to-Date / Custom Range.
export const getFacultyActivity = async (req, res) => {
  try {
    const { faculty, participation } = await analyticsService.getFacultyActivity(
      req.user.organizationId,
      req.validatedQuery
    );
    res.json({ success: true, faculty, participation });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/analytics/student-engagement  (Coordinator) — applications
// by year and by category, optionally scoped to one gender via ?gender=.
export const getStudentEngagement = async (req, res) => {
  try {
    const engagement = await analyticsService.getStudentEngagement(
      req.user.organizationId,
      req.validatedQuery.gender
    );
    res.json({ success: true, engagement });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/opportunities  (Coordinator) — the organization's full
// opportunity listing, for the Opportunities tab.
export const getOpportunities = async (req, res) => {
  try {
    const { opportunities, capped } = await analyticsService.getOpportunitiesList(
      req.user.organizationId,
      req.validatedQuery
    );
    if (capped) {
      logger.warn(
        { organizationId: req.user.organizationId },
        "Opportunities listing hit its cap — results were truncated"
      );
    }
    res.json({ success: true, count: opportunities.length, capped, opportunities });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/applications  (Coordinator) — the organization's
// cross-opportunity applications queue, for the Applications tab and the
// Total Applications / "awaiting first review" drill-downs on Overview.
export const getApplications = async (req, res) => {
  try {
    const result = await analyticsService.getApplicationsList(
      req.user.organizationId,
      req.validatedQuery
    );
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/analytics/trend  (Coordinator) — the Overview activity
// trend's period/series toggle (7d/30d/90d × Applications/Signups/Postings).
export const getActivityTrend = async (req, res) => {
  try {
    const trend = await analyticsService.getActivityTrend(
      req.user.organizationId,
      req.validatedQuery
    );
    res.json({ success: true, trend });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/faculty  (Coordinator) — full faculty roster.
export const getFaculty = async (req, res) => {
  try {
    const { faculty, capped } = await adminService.listFaculty(req.user.organizationId);
    if (capped) {
      logger.warn(
        { organizationId: req.user.organizationId },
        "Faculty roster hit its cap — results were truncated"
      );
    }
    res.json({ success: true, count: faculty.length, capped, faculty });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/faculty/:id  (Coordinator) — one faculty member's detail
// card: profile fields plus all-time postings/applications, for the
// engagement leaderboard and roster's "click a name" affordance.
export const getFacultyDetail = async (req, res) => {
  try {
    const faculty = await adminService.getFacultyDetail(
      req.user.organizationId,
      req.params.id
    );
    res.json({ success: true, faculty });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/students  (Coordinator) — paginated student roster,
// optionally filtered by gender, year and/or branch.
export const getStudents = async (req, res) => {
  try {
    const result = await adminService.listStudents(
      req.user.organizationId,
      req.validatedQuery
    );
    res.json({ success: true, ...result });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/students/year-counts  (Coordinator) — student counts per
// year, optionally scoped to one gender and/or branch; powers the Students
// tab's "By year" grouping headers without loading the whole roster.
export const getStudentYearCounts = async (req, res) => {
  try {
    const counts = await analyticsService.getStudentYearCounts(
      req.user.organizationId,
      req.validatedQuery.gender,
      req.validatedQuery.branch
    );
    res.json({ success: true, counts });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/admin/students/branches  (Coordinator) — the distinct branch
// values actually in use, so the Students tab's branch filter offers real
// options rather than a guessed list (branch has no controlled vocabulary).
export const getStudentBranches = async (req, res) => {
  try {
    const branches = await analyticsService.getStudentBranches(
      req.user.organizationId
    );
    res.json({ success: true, branches });
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
