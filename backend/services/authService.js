import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { AVATAR_DIR } from "../middleware/uploadAvatar.js";

import {
  findUserByEmail,
  createUser,
  findUserById,
  updateUserProfile,
} from "../repositories/authRepository.js";

// Removes a previously stored avatar from disk (best effort).
const removeAvatarFile = (imagePath) => {
  if (!imagePath || !imagePath.startsWith("/uploads/avatars/")) return;
  const filePath = path.join(AVATAR_DIR, path.basename(imagePath));
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Could not delete avatar file:", err.message);
    }
  });
};

export const registerUserService = async (
  userData
) => {

  const existingUser =
    await findUserByEmail(userData.email);

  if (existingUser) {
    throw new AppError("User already exists", 409);
  }

  const hashedPassword =
    await bcrypt.hash(userData.password, 10);

  const user = await createUser({
    ...userData,
    password: hashedPassword,
  });

  const userObj = user.toObject();
  delete userObj.password;
  return userObj;
};

export const loginUserService = async (
  email,
  password
) => {

  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch =
    await bcrypt.compare(
      password,
      user.password
    );

  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );

  return {
    token,
    user,
  };
};




// PROFILE SERVICES


  export const getProfileService = async (
      userId
      ) => {

        const user =
          await User.findById(userId)
            .select("-password");

          if (!user) {
            throw new AppError("User not found", 404);
          }

        return user;
  };

export const updateProfileService =
  async (userId, updates) => {

    const user =
      await updateUserProfile(
        userId,
        updates
      );

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  };

export const updateProfileImageService = async (userId, file) => {
  const existing = await findUserById(userId);
  if (!existing) {
    throw new AppError("User not found", 404);
  }

  // Replace the previous avatar, cleaning up the old file.
  if (existing.profileImage) removeAvatarFile(existing.profileImage);

  const imageUrl = `/uploads/avatars/${file.filename}`;
  return updateUserProfile(userId, { profileImage: imageUrl });
};

export const removeProfileImageService = async (userId) => {
  const existing = await findUserById(userId);
  if (!existing) {
    throw new AppError("User not found", 404);
  }

  if (existing.profileImage) removeAvatarFile(existing.profileImage);

  return updateUserProfile(userId, { profileImage: "" });
};