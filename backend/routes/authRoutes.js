import express from "express";

import {
  registerUser,
  loginUser,
  googleAuth,
} from "../controllers/authController.js";

import validate from "../middleware/validateMiddleware.js";

import {
  registerValidation,
  loginValidation,
  googleAuthValidation,
} from "../validators/authValidator.js";

import authMiddleware from "../middleware/authMiddleware.js";

import {
  updateProfileValidation,
} from "../validators/profileValidator.js";

import {
  getProfile,
  updateProfile,
  updateProfileImage,
  removeProfileImage,
} from "../controllers/authController.js";

import { uploadAvatar } from "../middleware/uploadAvatar.js";
import { registerLimiter, loginLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

// Parses the avatar from a multipart request and turns multer errors
// (wrong type / too large) into clean 400s.
const handleAvatarUpload = (req, res, next) => {
  uploadAvatar.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};




// AUTH ROUTES


// Register — an extra, stricter per-IP cap on account creation on top of the
// router-level auth limiter and the global API limiter.
router.post(
  "/register",
  registerLimiter,
  validate(registerValidation),
  registerUser
);

// Login — stacked with the router-level, IP-keyed authLimiter: this adds an
// account-keyed counter so a shared campus IP never shares one login budget
// across different students' own accounts (see rateLimiters.js's loginLimiter
// comment for the full trade-off).
router.post(
  "/login",
  loginLimiter,
  validate(loginValidation),
  loginUser
);

// Google sign-in / onboarding
router.post(
  "/google",
  validate(googleAuthValidation),
  googleAuth
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

router.post(
  "/profile/image",
  authMiddleware,
  handleAvatarUpload,
  updateProfileImage
);

router.delete(
  "/profile/image",
  authMiddleware,
  removeProfileImage
);



export default router;