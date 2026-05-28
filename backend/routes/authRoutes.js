import express from "express";

import {
  registerUser,
  loginUser,
} from "../controllers/authController.js";

import validate from "../middleware/validateMiddleware.js";

import {
  registerValidation,
  loginValidation,
} from "../validators/authValidator.js";

const router = express.Router();




// AUTH ROUTES


// Register
router.post(
  "/register",
  validate(registerValidation),
  registerUser
);

// Login
router.post(
  "/login",
  validate(loginValidation),
  loginUser
);



export default router;