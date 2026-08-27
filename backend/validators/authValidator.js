import Joi from "joi";




// REGISTER VALIDATION


export const registerValidation = Joi.object({

  name: Joi.string()
    .trim()
    .min(2)
    .max(60)
    // A real name: starts with a letter, then letters (any script), spaces,
    // and the punctuation names actually use — hyphen, apostrophe, period.
    // Rejects all-numeric or symbol-only "names".
    .pattern(/^\p{L}[\p{L}\p{M} .'-]*$/u)
    .required()
    .messages({
      "string.empty": "Name is required",
      "string.min": "Name must be at least 2 characters",
      "string.max": "Name must be at most 60 characters",
      "string.pattern.base":
        "Name may contain only letters, spaces, hyphens, apostrophes, and periods",
      "any.required": "Name is required",
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
    // Capped at 64: bcrypt only hashes the first 72 bytes, so anything longer
    // is silently truncated — better to reject it than to mislead the user.
    .max(64)
    // At least one lowercase, one uppercase, one digit, and one special char.
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters",
      "string.max": "Password must be at most 64 characters",
      "string.pattern.base":
        "Password must include an uppercase letter, a lowercase letter, a number, and a special character",
      "string.empty": "Password is required",
      "any.required": "Password is required",
    }),

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
    .min(1)
    .max(4)
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
  name: Joi.string()
    .trim()
    .min(2)
    .max(60)
    .pattern(/^\p{L}[\p{L}\p{M} .'-]*$/u)
    .messages({
      "string.pattern.base":
        "Name may contain only letters, spaces, hyphens, apostrophes, and periods",
    }),
  gender: Joi.string().valid("Male", "Female", "Other"),
  branch: Joi.string().allow("", null),
  year: Joi.number().min(1).max(4).allow("", null),
  department: Joi.string().allow("", null),
  employeeId: Joi.string().trim().max(50).allow("", null),

});