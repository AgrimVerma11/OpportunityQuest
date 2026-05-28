import Joi from "joi";

// CREATE OPPORTUNITY

export const createOpportunityValidation =
  Joi.object({

    title: Joi.string()
      .trim()
      .min(5)
      .max(120)
      .required(),

    description: Joi.string()
      .trim()
      .min(20)
      .max(3000)
      .required(),

    category: Joi.string()
      .valid(
        "Internship",
        "Research",
        "Paid Gig",
        "Faculty Project"
      )
      .required(),

    contactEmail: Joi.string()
      .trim()
      .lowercase()
      .email()
      .required(),

    eligibleBranches: Joi.array()
      .items(Joi.string())
      .default(["All"]),

    eligibleYears: Joi.array()
      .items(Joi.string())
      .default(["All"]),

    eligibleGender: Joi.string()
      .valid(
        "Male",
        "Female",
        "Any"
      )
      .default("Any"),

    tags: Joi.array()
      .items(Joi.string())
      .default([]),

    deadline: Joi.date()
      .greater("now")
      .required()
      .messages({
        "date.greater":
          "Deadline must be a future date",
      }),
  });