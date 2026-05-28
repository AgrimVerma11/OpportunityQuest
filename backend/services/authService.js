import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import {
  findUserByEmail,
  createUser,
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

  return user;
};

export const loginUserService = async (
  email,
  password
) => {

  const user = await findUserByEmail(email);

  if (!user) {
    throw new Error("User not found");
  }

  const isMatch =
    await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error("Invalid credentials");
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