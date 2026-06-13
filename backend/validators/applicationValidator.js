import Joi from "joi";
import { FACULTY_SETTABLE_STATUSES } from "../constants/applicationConstants.js";

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ "string.pattern.base": "Invalid opportunity identifier" });

// Apply is a multipart request; the resume file is validated by multer, the
// text fields here.
export const applyValidation = Joi.object({
  opportunityId: objectId.required(),
  coverLetter: Joi.string().trim().min(20).max(2000).required().messages({
    "string.min": "Cover letter must be at least 20 characters",
    "string.max": "Cover letter must be at most 2000 characters",
    "string.empty": "Cover letter is required",
  }),
});

export const statusUpdateValidation = Joi.object({
  status: Joi.string()
    .valid(...FACULTY_SETTABLE_STATUSES)
    .required()
    .messages({ "any.only": "Unsupported status" }),
});
