import User from "../models/User.js";
import Opportunity from "../models/Opportunity.js";
import Application from "../models/Application.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import * as storage from "../lib/storage/index.js";
import { reconcileApplicationCounts } from "../scripts/reconcile.js";
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

export const getPublicProfile = async (userId, organizationId) => {
  const user = await userRepo.findById(userId);
  if (!user || user.organizationId.toString() !== organizationId) {
    throw new AppError("Profile not found", 404);
  }

  return user.isProfilePublic === false
    ? toMinimalProfile(user)
    : toPublicProfile(user);
};

// The single, proper way to remove a user's entire footprint. Never delete a
// User document directly — that orphans their applications, conversations,
// messages and notifications, leaving "Unknown"/"Student" ghosts that are
// still actionable (the exact bug this app hit once already with deleted
// conversation participants). Used by both scripts/deleteUser.js (an
// operator's CLI tool) and adminService's coordinator-facing removeUser, so
// the cascade is implemented, and tested, in exactly one place.
//
// Cascades:
//   - opportunities the user posted, and every application/conversation/
//     message on them
//   - their own applications (as a student), with stored resumes removed
//   - conversations they participate in, with their messages
//   - notifications addressed to them
//   - their avatar in storage, if any
// Audit-log entries are intentionally left untouched — they are an immutable
// record and must survive the user they describe.
//
// Returns the per-collection counts removed, plus how many
// Opportunity.applicationsCount counters were healed afterward (deleting
// applications out from under an opportunity leaves that cached counter
// stale — see scripts/reconcile.js).
export const cascadeDeleteUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Opportunities this user posted.
  const oppIds = (await Opportunity.find({ postedBy: userId }, "_id")).map(
    (o) => o._id
  );

  // Applications: the user's own + any made to their opportunities.
  const apps = await Application.find(
    { $or: [{ student: userId }, { opportunity: { $in: oppIds } }] },
    "_id resume"
  );
  for (const a of apps) {
    if (a.resume?.key) await storage.remove(a.resume.key).catch(() => {});
  }
  const appIds = apps.map((a) => a._id);

  // Conversations the user is in, or that hang off their opportunities/apps.
  const convoIds = (
    await Conversation.find(
      {
        $or: [
          { student: userId },
          { faculty: userId },
          { opportunity: { $in: oppIds } },
          { application: { $in: appIds } },
        ],
      },
      "_id"
    )
  ).map((c) => c._id);

  const removed = {
    messages: (
      await Message.deleteMany({ conversationId: { $in: convoIds } })
    ).deletedCount,
    conversations: (
      await Conversation.deleteMany({ _id: { $in: convoIds } })
    ).deletedCount,
    applications: (
      await Application.deleteMany({ _id: { $in: appIds } })
    ).deletedCount,
    opportunities: (
      await Opportunity.deleteMany({ _id: { $in: oppIds } })
    ).deletedCount,
    notifications: (
      await Notification.deleteMany({ recipient: userId })
    ).deletedCount,
  };

  // Their avatar in storage, if any.
  if (user.profileImage) {
    const key = storage.keyFromPublicUrl?.(user.profileImage);
    if (key) await storage.remove(key).catch(() => {});
  }

  await User.deleteOne({ _id: userId });

  // Heal Opportunity.applicationsCount on any surviving opportunity this user
  // had applied to (its counter was just decremented out-of-band).
  const countersFixed = await reconcileApplicationCounts();

  return { removed, countersFixed };
};
