import Joi from "joi";




// REGISTER VALIDATION


export const registerValidation = Joi.object({

  name: Joi.string()
    .trim()
    .min(2)
    .max(60)
    .required()
    .messages({
      "string.empty": "Name is required",
    }),

  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .required()
    .messages({
      "string.email": "Invalid email format",
    }),

  password: Joi.string()
    .min(8)
    .max(30)
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

  branch: Joi.string()
    .allow("", null),

  year: Joi.number()
    .allow("", null),

  department: Joi.string()
    .allow("", null),

  interests: Joi.string()
    .allow("", null),

  employeeId: Joi.string()
    .trim()
    .max(50)
    .allow("", null),

});




// LOGIN VALIDATION


export const loginValidation = Joi.object({

  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .required(),

  password: Joi.string()
    .required(),

});




// GOOGLE SIGN-IN / ONBOARDING VALIDATION


export const googleAuthValidation = Joi.object({

  credential: Joi.string().required(),

  // Present only on the onboarding (account-creation) call.
  role: Joi.string().valid("Student", "Faculty"),
  name: Joi.string().trim().min(2).max(60),
  gender: Joi.string().valid("Male", "Female", "Other"),
  branch: Joi.string().allow("", null),
  year: Joi.number().allow("", null),
  department: Joi.string().allow("", null),
  employeeId: Joi.string().trim().max(50).allow("", null),

});