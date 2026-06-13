import * as userRepo from "../repositories/userRepository.js";
import { AppError } from "../utils/AppError.js";

// Public-safe view of a user (no email, password or analytics counters).
const toPublicProfile = (u) => ({
  _id: u._id,
  name: u.name,
  role: u.role,
  prefix: u.prefix || "",
  profileImage: u.profileImage || "",
  department: u.department || "",
  designation: u.designation || "",
  office: u.office || "",
  interests: u.interests || "",
  bio: u.bio || "",
  linkedinUrl: u.linkedinUrl || "",
  branch: u.branch || "",
  year: u.year || null,
  skills: u.skills || [],
  society: u.society || { name: "", position: "" },
  projects: u.projects || [],
});

// Minimal view when a user has hidden their profile.
const toMinimalProfile = (u) => ({
  _id: u._id,
  name: u.name,
  role: u.role,
  prefix: u.prefix || "",
  profileImage: u.profileImage || "",
  department: u.department || "",
  branch: u.branch || "",
});

export const getPublicProfile = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new AppError("Profile not found", 404);
  }

  return user.isProfilePublic === false
    ? toMinimalProfile(user)
    : toPublicProfile(user);
};
