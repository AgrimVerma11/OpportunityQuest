import Joi from "joi";

import { OPPORTUNITY_CATEGORIES } from "../constants/opportunityConstants.js";
import { APPLICATION_STATUSES } from "../constants/applicationConstants.js";

// "Mon YYYY", e.g. "Sep 2026" — the only month token shape the faculty-activity
// endpoint accepts. Validated here (allow-list, not free-form Date parsing) so
// a malformed token is rejected with a clean 400 before it ever reaches a
// query — see resolveFacultyActivityRange in analyticsService.js, which can
// then assume every token it receives is well-formed.
const MONTH_TOKEN =
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;

export const rejectFacultyValidation = Joi.object({
  reason: Joi.string().trim().max(500).allow("", null),
});

export const banUserValidation = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required().messages({
    "string.empty": "A reason is required to suspend an account",
    "any.required": "A reason is required to suspend an account",
  }),
});

export const removeUserValidation = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required().messages({
    "string.empty": "A reason is required to remove an account",
    "any.required": "A reason is required to remove an account",
  }),
});

// ── Analytics query params ──────────────────────────────────────────
// Every filter is an explicit allow-list (Joi .valid(...)), not a free-form
// string — an unrecognised value is a 400, never something that reaches a
// Mongo query. This is what stands between a query param and NoSQL operator
// injection (e.g. ?category[$ne]=null arriving as an object, not a string).

export const funnelQueryValidation = Joi.object({
  category: Joi.string()
    .valid(...OPPORTUNITY_CATEGORIES)
    .optional(),
});

export const opportunitiesListQueryValidation = Joi.object({
  status: Joi.string().valid("Active", "Expired", "Archived", "Closed").optional(),
  category: Joi.string()
    .valid(...OPPORTUNITY_CATEGORIES)
    .optional(),
  sort: Joi.string().valid("deadline", "applications", "default").optional(),
});

export const studentEngagementQueryValidation = Joi.object({
  gender: Joi.string().valid("Male", "Female", "Other").optional(),
});

// branch has no controlled vocabulary (free text on the User model) — bounded
// by type and length rather than an allow-list. It still can never reach the
// query as anything but a plain string: Joi's type check alone rules out the
// object-shaped values ({$ne: null}, arrays from a repeated key) that an
// equality $match would otherwise be at risk from.
const BRANCH = Joi.string().trim().max(100).optional();

export const studentsListQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  gender: Joi.string().valid("Male", "Female", "Other").optional(),
  year: Joi.number().integer().valid(1, 2, 3, 4).optional(),
  branch: BRANCH,
});

export const studentYearCountsQueryValidation = Joi.object({
  gender: Joi.string().valid("Male", "Female", "Other").optional(),
  branch: BRANCH,
});

// mode drives which of month / from+to is required; topN is capped at 100
// server-side regardless of what the client asks for.
export const facultyActivityQueryValidation = Joi.object({
  mode: Joi.string().valid("month", "ytd", "custom").default("month"),
  month: Joi.string()
    .pattern(MONTH_TOKEN)
    .when("mode", { is: "month", then: Joi.required(), otherwise: Joi.optional() }),
  from: Joi.string()
    .pattern(MONTH_TOKEN)
    .when("mode", { is: "custom", then: Joi.required(), otherwise: Joi.optional() }),
  to: Joi.string()
    .pattern(MONTH_TOKEN)
    .when("mode", { is: "custom", then: Joi.required(), otherwise: Joi.optional() }),
  topN: Joi.number().integer().min(1).max(100).default(5),
  sortBy: Joi.string().valid("apps", "postings").default("apps"),
}).messages({
  "string.pattern.base": 'Expected a month like "Sep 2026"',
});

// The cross-opportunity applications queue — page/limit match
// studentsListQueryValidation; status is an allow-list off the application
// domain's own enum rather than a free string.
export const applicationsListQueryValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  status: Joi.string()
    .valid(...APPLICATION_STATUSES)
    .optional(),
});

// The Overview activity trend's period/series toggle.
export const activityTrendQueryValidation = Joi.object({
  period: Joi.string().valid("7d", "30d", "90d").default("30d"),
  series: Joi.string()
    .valid("applications", "signups", "postings")
    .default("applications"),
});
