import Joi from "joi";

export const registerValidation = Joi.object({

  name: Joi.string().required(),

  email: Joi.string()
    .email()
    .required(),

  password: Joi.string()
    .min(6)
    .required(),

  confirmPassword: Joi.any()
    .valid(Joi.ref("password"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
    }),

  role: Joi.string()
    .valid("Student", "Faculty")
    .required(),

  gender: Joi.string()
    .valid("Male", "Female", "Other")
    .required(),

  branch: Joi.string().allow("", null),

  year: Joi.number().allow("", null),

  department: Joi.string().allow("", null),

  interests: Joi.string().allow("", null),

});