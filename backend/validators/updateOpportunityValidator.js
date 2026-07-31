import Joi from "joi";

export const updateOpportunityValidation = Joi.object({
  title: Joi.string().trim().min(5).max(120),
  description: Joi.string().trim().min(20).max(3000),
  category: Joi.string().valid("Internship", "Research", "Paid Gig", "Faculty Project"),
  contactEmail: Joi.string().trim().lowercase().email(),
  eligibleBranches: Joi.array().items(Joi.string()),
  eligibleYears: Joi.array().items(Joi.string()),
  eligibleGender: Joi.string().valid("Male", "Female", "Any"),
  tags: Joi.array().items(Joi.string()),
  // Any valid date is accepted here; the "must be in the future" rule is
  // enforced in the service, which can tell whether the deadline actually
  // changed (an unchanged past deadline on an expired opportunity is fine).
  deadline: Joi.date(),
});

export const extendDeadlineValidation = Joi.object({
  newDeadline: Joi.date().greater("now").required().messages({
    "date.greater": "New deadline must be a future date",
  }),
  reason: Joi.string().trim().max(300).allow(""),
});

// Reactivating an archived opportunity — the new deadline is optional
// (the faculty may choose to keep the existing one).
export const unarchiveValidation = Joi.object({
  newDeadline: Joi.date().greater("now").messages({
    "date.greater": "New deadline must be a future date",
  }),
});
