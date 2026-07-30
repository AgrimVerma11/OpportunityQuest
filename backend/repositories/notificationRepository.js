import Notification from "../models/Notification.js";

// Repository — the only place that talks to the Notification collection.

export const create = (data) => Notification.create(data);

// Bulk insert, for fanning one event out to several recipients (e.g. every
// coordinator in an organization).
export const createMany = (docs) => Notification.insertMany(docs);

// A recipient's most recent notifications, newest first.
export const findByRecipient = (recipientId, limit = 20) =>
  Notification.find({ recipient: recipientId })
    .sort({ createdAt: -1 })
    .limit(limit);

export const countUnread = (recipientId) =>
  Notification.countDocuments({ recipient: recipientId, read: false });

// Marks one notification read — scoped to its owner so a user can only ever
// touch their own. Returns the updated document, or null if it wasn't theirs.
export const markRead = (id, recipientId) =>
  Notification.findOneAndUpdate(
    { _id: id, recipient: recipientId, read: false },
    { read: true, readAt: new Date() },
    { returnDocument: "after" }
  );

export const markAllRead = (recipientId) =>
  Notification.updateMany(
    { recipient: recipientId, read: false },
    { read: true, readAt: new Date() }
  );
