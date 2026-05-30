import Joi from "joi";

export const updateProfileValidation =
  Joi.object({

    name: Joi.string()
      .trim()
      .min(2)
      .max(60),

    department: Joi.string()
      .trim()
      .max(100)
      .allow(""),

    designation: Joi.string()
      .trim()
      .max(100)
      .allow(""),

    interests: Joi.string()
      .trim()
      .max(300)
      .allow(""),

    bio: Joi.string()
      .trim()
      .max(500)
      .allow(""),

    linkedinUrl: Joi.string()
      .trim()
      .allow(""),

    researchDomains: Joi.array()
      .items(Joi.string().trim())
      .default([]),

  });