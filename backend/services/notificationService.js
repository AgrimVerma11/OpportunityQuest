import * as notificationRepo from "../repositories/notificationRepository.js";
import * as userRepo from "../repositories/userRepository.js";
import * as emailService from "./emailService.js";
import { shouldEmail } from "../constants/notificationConstants.js";

// Creates an in-app notification and, for types that warrant it, fires an email
// nudge. The in-app write is awaited — it's the record — but wrapped so it can
// never throw into the caller: a notification is a side effect of an action,
// not a precondition for it (see phase-6 ADR-6.1). The email nudge is
// fire-and-forget on top of that.
export const notify = async ({
  organizationId,
  recipientId,
  type,
  title,
  body = "",
  link = "",
  actor,
  recipientEmail,
}) => {
  try {
    await notificationRepo.create({
      organizationId,
      recipient: recipientId,
      type,
      title,
      body,
      link,
      actor,
    });

    if (shouldEmail(type)) {
      const to =
        recipientEmail || (await userRepo.findById(recipientId))?.email;
      if (to) emailService.sendNotificationEmail(to, { title, body, link });
    }
  } catch (err) {
    console.error("Failed to create notification:", err.message);
  }
};

// Fans one event out to several recipients (each shaped { _id, email }).
export const notifyMany = (recipients, payload) =>
  Promise.all(
    recipients.map((r) =>
      notify({ ...payload, recipientId: r._id, recipientEmail: r.email })
    )
  );

// ── Read side (API) ───────────────────────────────────────────────

export const listForUser = (userId) => notificationRepo.findByRecipient(userId);

export const unreadCount = (userId) => notificationRepo.countUnread(userId);

export const markRead = (id, userId) => notificationRepo.markRead(id, userId);

export const markAllRead = (userId) => notificationRepo.markAllRead(userId);

export const remove = (id, userId) => notificationRepo.remove(id, userId);

export const clearAll = (userId) => notificationRepo.removeAll(userId);
