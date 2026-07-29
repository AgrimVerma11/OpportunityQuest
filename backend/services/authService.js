import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import * as storage from "../lib/storage/index.js";
import { avatarKey } from "../lib/storage/keys.js";
import { ROLES, ACCOUNT_STATUS } from "../constants/userConstants.js";

import {
  findUserByEmail,
  createUser,
  findUserById,
  updateUserProfile,
} from "../repositories/authRepository.js";
import * as organizationRepo from "../repositories/organizationRepository.js";
import { verifyGoogleCredential } from "../config/googleClient.js";

// Removes a previously stored avatar (best effort). profileImage holds the
// object's public URL; recover the storage key from it to delete the object.
const removeAvatar = async (imageUrl) => {
  const key = storage.keyFromPublicUrl(imageUrl);
  if (!key) return;
  try {
    await storage.remove(key);
  } catch (err) {
    console.error("Could not delete avatar:", err.message);
  }
};

// Signs the app's session token. A user's id, role and organization do not
// change mid-session, so they are safe to carry in it.
const signToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      role: user.role,
      organizationId: user.organizationId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

// Refuses sign-in for an account that is not usable, with a specific message.
const assertCanSignIn = (user) => {
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

  // A Google-only account has no password to compare against.
  if (!user.password) {
    throw new AppError(
      "This account uses Google sign-in. Please continue with Google.",
      400
    );
  }

  const isMatch =
    await bcrypt.compare(
      password,
      user.password
    );

  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  assertCanSignIn(user);

  return {
    token: signToken(user),
    user,
  };
};

// Sign in (or register) with Google. Verifies the credential, restricts to a
// recognized institutional domain, links the Google identity to an existing
// account or — with onboarding details — creates a new one. Faculty created
// this way are still Pending: Google proves the domain, not that the person is
// faculty; the coordinator's approval is unchanged.
export const authenticateWithGoogle = async (credential, onboarding = {}) => {
  const { email, emailVerified, name, googleId } =
    await verifyGoogleCredential(credential);

  if (!email || !emailVerified) {
    throw new AppError(
      "Your Google account email could not be verified.",
      400
    );
  }

  const domain = email.split("@")[1];
  const organization = domain
    ? await organizationRepo.findByEmailDomain(domain)
    : null;
  if (!organization) {
    throw new AppError(
      "Sign-in is restricted to recognized institutional accounts.",
      400
    );
  }

  const existing = await findUserByEmail(email);

  if (existing) {
    // Link the Google identity to the existing account on first use.
    if (!existing.googleId) {
      await updateUserProfile(existing._id, { googleId });
    }
    assertCanSignIn(existing);
    return { status: "signed-in", token: signToken(existing), user: existing };
  }

  // No account yet — we need the role (and role-specific details) to create one.
  if (!onboarding.role) {
    return { status: "needs-onboarding", email, name };
  }

  const accountStatus =
    onboarding.role === ROLES.FACULTY
      ? ACCOUNT_STATUS.PENDING
      : ACCOUNT_STATUS.ACTIVE;

  const created = await createUser({
    organizationId: organization._id,
    name: onboarding.name?.trim() || name || email.split("@")[0],
    email,
    googleId,
    role: onboarding.role,
    gender: onboarding.gender || "Other",
    branch: onboarding.branch || "",
    year: onboarding.year || undefined,
    department: onboarding.department || "",
    employeeId: onboarding.employeeId || "",
    accountStatus,
  });

  if (accountStatus === ACCOUNT_STATUS.PENDING) {
    return { status: "pending", email };
  }
  return { status: "signed-in", token: signToken(created), user: created };
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

  // Store the new image first; only then swap it in and clean up the old one,
  // so a failed upload never leaves the profile pointing at nothing.
  const key = avatarKey(file.mimetype);
  await storage.put(key, { body: file.buffer, contentType: file.mimetype });

  const previous = existing.profileImage;
  const updated = await updateUserProfile(userId, {
    profileImage: storage.publicUrl(key),
  });

  if (previous) await removeAvatar(previous);
  return updated;
};

export const removeProfileImageService = async (userId) => {
  const existing = await findUserById(userId);
  if (!existing) {
    throw new AppError("User not found", 404);
  }

  if (existing.profileImage) await removeAvatar(existing.profileImage);

  return updateUserProfile(userId, { profileImage: "" });
};