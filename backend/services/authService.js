import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { AVATAR_DIR } from "../middleware/uploadAvatar.js";
import { ROLES, ACCOUNT_STATUS } from "../constants/userConstants.js";

import {
  findUserByEmail,
  createUser,
  findUserById,
  updateUserProfile,
} from "../repositories/authRepository.js";
import * as organizationRepo from "../repositories/organizationRepository.js";

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

  const domain = userData.email.split("@")[1];
  const organization = domain
    ? await organizationRepo.findByEmailDomain(domain)
    : null;

  if (!organization) {
    throw new AppError(
      "Registration is restricted to recognized institutional email addresses.",
      400
    );
  }

  const existingUser =
    await findUserByEmail(userData.email);

  if (existingUser) {
    throw new AppError("User already exists", 409);
  }

  const hashedPassword =
    await bcrypt.hash(userData.password, 10);

  // Students are usable immediately; faculty wait for a coordinator.
  const accountStatus =
    userData.role === ROLES.FACULTY
      ? ACCOUNT_STATUS.PENDING
      : ACCOUNT_STATUS.ACTIVE;

  const user = await createUser({
    ...userData,
    organizationId: organization._id,
    accountStatus,
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

  // Gate sign-in on the account's status. Faculty cannot sign in until a
  // coordinator approves; a rejected or suspended account is refused.
  if (user.accountStatus === ACCOUNT_STATUS.PENDING) {
    throw new AppError("Your account is awaiting coordinator approval.", 403);
  }
  if (user.accountStatus === ACCOUNT_STATUS.REJECTED) {
    throw new AppError(
      "Your account request was not approved. Please contact your coordinator.",
      403
    );
  }
  if (user.accountStatus === ACCOUNT_STATUS.SUSPENDED) {
    throw new AppError("Your account has been suspended.", 403);
  }

  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
      organizationId: user.organizationId,
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