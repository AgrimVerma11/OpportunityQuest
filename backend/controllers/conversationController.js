import * as conversationService from "../services/conversationService.js";
import { respondError } from "../utils/respondError.js";

// Controller — every action is scoped to the authenticated user; the service
// enforces that only the two participants of a conversation can touch it.

// POST /api/conversations  (Faculty starts, from an application)
export const start = async (req, res) => {
  try {
    const conversation = await conversationService.startConversation(
      req.user.id,
      req.user.organizationId,
      req.body
    );
    res.status(201).json({ success: true, conversation });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/conversations  (the caller's inbox)
export const list = async (req, res) => {
  try {
    const conversations = await conversationService.listForUser(req.user.id);
    res.json({ success: true, conversations });
  } catch (error) {
    respondError(res, error);
  }
};

// GET /api/conversations/:id  (thread; marks the reader's side read)
export const thread = async (req, res) => {
  try {
    const { conversation, messages, canSend } =
      await conversationService.getThread(req.user.id, req.params.id);
    res.json({ success: true, conversation, messages, canSend });
  } catch (error) {
    respondError(res, error);
  }
};

// POST /api/conversations/:id/messages  (either participant sends)
export const send = async (req, res) => {
  try {
    const message = await conversationService.sendMessage(
      req.user.id,
      req.params.id,
      req.body.body
    );
    res.status(201).json({ success: true, message });
  } catch (error) {
    respondError(res, error);
  }
};

// DELETE /api/conversations/:id  (either participant deletes the thread)
export const remove = async (req, res) => {
  try {
    await conversationService.deleteConversation(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    respondError(res, error);
  }
};
