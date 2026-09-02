import Joi from "joi";

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
