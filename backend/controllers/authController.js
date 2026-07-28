import {
  registerUserService,
  loginUserService,
  authenticateWithGoogle,
  getProfileService,
  updateProfileService,
  updateProfileImageService,
  removeProfileImageService,
} from "../services/authService.js";

import { AppError } from "../utils/AppError.js";
import { respondError } from "../utils/respondError.js";

// Controller — request handling and response formatting only.
// Business rules live in the service; persistence in the repository.

// REGISTER USER
export const registerUser = async (req, res) => {
  try {
    const user = await registerUserService(req.body);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: { user },
    });
  } catch (error) {
    respondError(res, error);
  }
};

// LOGIN USER
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await loginUserService(email, password);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token: result.token,
        user: {
          id: result.user._id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          prefix: result.user.prefix || "",
          profileImage: result.user.profileImage || "",
        },
      },
    });
  } catch (error) {
    respondError(res, error);
  }
};

// POST /api/auth/google
export const googleAuth = async (req, res) => {
  try {
    const { credential, ...onboarding } = req.body;
    const result = await authenticateWithGoogle(credential, onboarding);

    if (result.status === "signed-in") {
      return res.json({
        success: true,
        status: "signed-in",
        message: "Login successful",
        data: {
          token: result.token,
          user: {
            id: result.user._id,
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
            prefix: result.user.prefix || "",
            profileImage: result.user.profileImage || "",
          },
        },
      });
    }

    if (result.status === "needs-onboarding") {
      return res.json({
        success: true,
        status: "needs-onboarding",
        email: result.email,
        name: result.name,
      });
    }

    // Faculty created via Google — awaiting coordinator approval.
    return res.json({
      success: true,
      status: "pending",
      message: "Your account is awaiting coordinator approval.",
    });
  } catch (error) {
    respondError(res, error);
  }
};

// PATCH /api/auth/profile/image
export const updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      throw new AppError("No image uploaded", 400);
    }
    const profile = await updateProfileImageService(req.user.id, req.file);
    res.json({
      success: true,
      message: "Profile image updated",
      profile,
    });
  } catch (error) {
    respondError(res, error);
  }
};

// DELETE /api/auth/profile/image
export const removeProfileImage = async (req, res) => {
  try {
    const profile = await removeProfileImageService(req.user.id);
    res.json({
      success: true,
      message: "Profile image removed",
      profile,
    });
  } catch (error) {
    respondError(res, error);
  }
};

// GET PROFILE
export const getProfile = async (req, res) => {
  try {
    const user = await getProfileService(req.user.id);

    res.json({
      success: true,
      profile: user,
    });
  } catch (error) {
    respondError(res, error);
  }
};

// UPDATE PROFILE
export const updateProfile = async (req, res) => {
  try {
    const user = await updateProfileService(req.user.id, req.body);

    res.json({
      success: true,
      message: "Profile updated successfully",
      profile: user,
    });
  } catch (error) {
    respondError(res, error);
  }
};
