import Joi from "joi";

export const rejectFacultyValidation = Joi.object({
  reason: Joi.string().trim().max(500).allow("", null),
});
