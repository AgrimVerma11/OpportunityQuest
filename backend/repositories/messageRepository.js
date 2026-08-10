import Message from "../models/Message.js";

// Repository — the only place that talks to the Message collection. Messages
// carry only a sender id; the thread view labels "you" vs the other participant
// by comparing against the conversation, so no populate is needed here.

export const create = (data) => Message.create(data);

export const findByConversation = (conversationId) =>
  Message.find({ conversationId }).sort({ createdAt: 1 });

// Cascade helper: remove every message in a conversation (used when the
// conversation itself is deleted).
export const deleteByConversation = (conversationId) =>
  Message.deleteMany({ conversationId });
