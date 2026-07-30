import * as notificationService from "../services/notificationService.js";
import { respondError } from "../utils/respondError.js";

// Controller — every action is scoped to the authenticated user, so a caller
// only ever sees or touches their own notifications.

// GET /api/notifications
export const list = async (req, res) => {
  try {
    const notifications = await notificationService.listForUser(req.user.id);
    res.json({ success: true, notifications });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/notifications/unread-count
export const unreadCount = async (req, res) => {
  try {
    const count = await notificationService.unreadCount(req.user.id);
    res.json({ success: true, count });
  } catch (error) {
    respondError(res, error);
  }
};

// PATCH /api/notifications/:id/read
// Idempotent and owner-scoped: marking someone else's (or an already-read)
// notification simply does nothing and still succeeds.
export const markRead = async (req, res) => {
  try {
    await notificationService.markRead(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    respondError(res, error);
  }
};

// PATCH /api/notifications/read-all
export const markAllRead = async (req, res) => {
  try {
    await notificationService.markAllRead(req.user.id);
    res.json({ success: true });
  } catch (error) {
    respondError(res, error);
  }
};

// DELETE /api/notifications/:id  (owner-scoped, idempotent)
export const remove = async (req, res) => {
  try {
    await notificationService.remove(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    respondError(res, error);
  }
};

// DELETE /api/notifications  (clear all of the caller's notifications)
export const clearAll = async (req, res) => {
  try {
    await notificationService.clearAll(req.user.id);
    res.json({ success: true });
  } catch (error) {
    respondError(res, error);
  }
};
