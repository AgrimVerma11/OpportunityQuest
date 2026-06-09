import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

import {
  findUserByEmail,
  createUser,
  findUserById,
  updateUserProfile,
} from "../repositories/authRepository.js";

export const registerUserService = async (
  userData
) => {

  const existingUser =
    await findUserByEmail(userData.email);

  if (existingUser) {
    throw new Error("User already exists");
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
    throw new Error("Invalid email or password");
  }

  const isMatch =
    await bcrypt.compare(
      password,
      user.password
    );

  if (!isMatch) {
    throw new Error("Invalid email or password");
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
            throw new Error("User not found");
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
      throw new Error(
        "User not found"
      );
    }

    return user;
  };