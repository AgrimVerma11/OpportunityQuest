import * as conversationRepo from "../repositories/conversationRepository.js";
import * as messageRepo from "../repositories/messageRepository.js";
import * as applicationRepo from "../repositories/applicationRepository.js";
import * as opportunityRepo from "../repositories/opportunityRepository.js";
import * as userRepo from "../repositories/userRepository.js";
import * as notificationService from "./notificationService.js";
import { AppError } from "../utils/AppError.js";
import { MESSAGEABLE_STATUSES } from "../constants/applicationConstants.js";
import { NOTIFICATION_TYPES } from "../constants/notificationConstants.js";

// Service — private messaging scoped to an application. The two participants
// are the application's student and the faculty member who posted the
// opportunity; no one else (coordinators and SuperAdmins included) can read,
// list, or send. Whether a thread accepts new messages is derived from the live
// application status, never stored, so it can't drift.

const idOf = (ref) => (ref?._id ? ref._id : ref)?.toString();

// The caller's role in a conversation, or null if they are not a participant.
const roleOf = (conversation, userId) => {
  if (idOf(conversation.student) === userId) return "student";
  if (idOf(conversation.faculty) === userId) return "faculty";
  return null;
};

const isOpen = (application) =>
  MESSAGEABLE_STATUSES.includes(application.status);

const MAX_BODY = 2000;
const assertMessageBody = (body) => {
  if (!body || !body.trim()) {
    throw new AppError("A message is required", 400);
  }
  if (body.length > MAX_BODY) {
    throw new AppError(`Message is too long (max ${MAX_BODY} characters)`, 400);
  }
};

// Persists a message, advances the conversation's "last message" fields, bumps
// the recipient's unread counter, and notifies them (in-app + email nudge).
const deliverMessage = async (conversation, senderId, rawBody) => {
  const body = rawBody.trim();
  const message = await messageRepo.create({
    conversationId: conversation._id,
    sender: senderId,
    body,
  });

  const senderRole = roleOf(conversation, senderId);
  const snippet = body.slice(0, 140);
  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessageSnippet = snippet;
  if (senderRole === "student") conversation.unreadFaculty += 1;
  else conversation.unreadStudent += 1;
  await conversationRepo.save(conversation);

  const recipientId =
    senderRole === "student"
      ? idOf(conversation.faculty)
      : idOf(conversation.student);

  await notificationService.notify({
    organizationId: conversation.organizationId,
    recipientId,
    type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
    title: "New message",
    body: snippet,
    link: `/messages/${conversation._id}`,
    actor: senderId,
  });

  return message;
};

// ── Faculty: start (or continue) a conversation from an application ──

export const startConversation = async (
  facultyId,
  organizationId,
  { applicationId, body }
) => {
  assertMessageBody(body);

  const application = await applicationRepo.findById(applicationId);
  if (
    !application ||
    application.organizationId.toString() !== organizationId
  ) {
    throw new AppError("Application not found", 404);
  }

  // The faculty member must own the opportunity — that's what makes them the
  // conversation's faculty participant. Anyone else reads as not-found.
  const opportunity = await opportunityRepo.findById(application.opportunity);
  if (!opportunity || opportunity.postedBy.toString() !== facultyId) {
    throw new AppError("Application not found", 404);
  }

  if (!isOpen(application)) {
    throw new AppError(
      "You can only message shortlisted or selected applicants",
      400
    );
  }

  // The applicant may have been removed. Don't open a thread into the void.
  const student = await userRepo.findById(application.student);
  if (!student) {
    throw new AppError("This applicant is no longer available.", 410);
  }

  let conversation = await conversationRepo.findByApplication(applicationId);
  if (!conversation) {
    conversation = await conversationRepo.create({
      organizationId,
      application: application._id,
      student: application.student,
      faculty: facultyId,
      opportunity: opportunity._id,
      opportunityTitle: opportunity.title,
    });
  }

  await deliverMessage(conversation, facultyId, body);
  return conversation;
};

// ── Either participant: send into an existing conversation ──────────

export const sendMessage = async (userId, conversationId, body) => {
  assertMessageBody(body);

  const conversation = await conversationRepo.findById(conversationId);
  if (!conversation || !roleOf(conversation, userId)) {
    throw new AppError("Conversation not found", 404);
  }

  const application = await applicationRepo.findById(conversation.application);
  if (!application || !isOpen(application)) {
    throw new AppError("This conversation is read-only", 403);
  }

  // The other participant may have been removed since the thread was opened.
  const recipientId =
    roleOf(conversation, userId) === "student"
      ? idOf(conversation.faculty)
      : idOf(conversation.student);
  const recipient = await userRepo.findById(recipientId);
  if (!recipient) {
    throw new AppError("The other participant is no longer available.", 410);
  }

  return deliverMessage(conversation, userId, body);
};

// ── Either participant: the inbox ───────────────────────────────────

export const listForUser = async (userId) => {
  const conversations = await conversationRepo.findForUser(userId);
  return conversations.map((c) => {
    const role = roleOf(c, userId);
    return {
      _id: c._id,
      opportunityTitle: c.opportunityTitle,
      lastMessageAt: c.lastMessageAt,
      lastMessageSnippet: c.lastMessageSnippet,
      unread: role === "student" ? c.unreadStudent : c.unreadFaculty,
      counterpart: role === "student" ? c.faculty : c.student,
    };
  });
};

// ── Either participant: a thread (marks the reader's side read) ─────

export const getThread = async (userId, conversationId) => {
  const conversation = await conversationRepo.findByIdPopulated(conversationId);
  if (!conversation || !roleOf(conversation, userId)) {
    throw new AppError("Conversation not found", 404);
  }

  const messages = await messageRepo.findByConversation(conversation._id);

  // Opening the thread clears the reader's unread.
  const role = roleOf(conversation, userId);
  if (role === "student" && conversation.unreadStudent > 0) {
    conversation.unreadStudent = 0;
    await conversationRepo.save(conversation);
  } else if (role === "faculty" && conversation.unreadFaculty > 0) {
    conversation.unreadFaculty = 0;
    await conversationRepo.save(conversation);
  }

  const application = await applicationRepo.findById(conversation.application);

  return {
    conversation,
    messages,
    canSend: application ? isOpen(application) : false,
  };
};

// ── Either participant: delete the conversation and all its messages ──
// A hard delete that removes the shared thread for both people. Allowed for
// either participant; anyone else reads as not-found (never leaks existence).

export const deleteConversation = async (userId, conversationId) => {
  const conversation = await conversationRepo.findById(conversationId);
  if (!conversation || !roleOf(conversation, userId)) {
    throw new AppError("Conversation not found", 404);
  }

  // Remove the messages first so a mid-way failure can't orphan them.
  await messageRepo.deleteByConversation(conversation._id);
  await conversationRepo.deleteById(conversation._id);
};
