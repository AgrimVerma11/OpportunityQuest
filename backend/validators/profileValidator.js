import Joi from "joi";

// Whitelist of profile fields a user may edit. Anything not listed here
// (role, email, password, analytics counters, …) is stripped by the
// validation middleware, preventing mass-assignment.
export const updateProfileValidation = Joi.object({
  name: Joi.string().trim().min(2).max(60),

  // Shared
  bio: Joi.string().trim().max(1000).allow("").messages({
    "string.max": "About section must be at most 1000 characters",
  }),
  linkedinUrl: Joi.string().trim().max(200).allow(""),
  interests: Joi.string().trim().max(300).allow(""),

  // Faculty
  prefix: Joi.string().valid("", "Dr.", "Prof."),
  department: Joi.string().trim().max(100).allow(""),
  designation: Joi.string().trim().max(100).allow(""),
  office: Joi.string().trim().max(120).allow(""),
  researchDomains: Joi.array().items(Joi.string().trim()).default([]),

  // Student
  branch: Joi.string().trim().max(20).allow(""),
  year: Joi.number().min(1).max(4).allow(null),
  skills: Joi.array().items(Joi.string().trim().max(60)).max(3),
  society: Joi.object({
    name: Joi.string().trim().max(100).allow(""),
    position: Joi.string().trim().max(60).allow(""),
  }),
  projects: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().trim().max(120).allow(""),
        description: Joi.string().trim().max(500).allow(""),
      })
    )
    .max(2),
});
