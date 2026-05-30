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

import authMiddleware from "../middleware/authMiddleware.js";

import {
  updateProfileValidation,
} from "../validators/profileValidator.js";

import {
  getProfile,
  updateProfile,
} from "../controllers/authController.js";

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

router.get(
  "/profile",
  authMiddleware,
  getProfile
);

router.put(
  "/profile",
  authMiddleware,
  validate(
    updateProfileValidation
  ),
  updateProfile
);



export default router;