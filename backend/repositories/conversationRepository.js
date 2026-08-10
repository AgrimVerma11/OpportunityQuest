import Conversation from "../models/Conversation.js";

// Repository — the only place that talks to the Conversation collection.

const PARTICIPANT_FIELDS = "name profileImage prefix role";

export const findByApplication = (applicationId) =>
  Conversation.findOne({ application: applicationId });

export const findById = (id) => Conversation.findById(id);

// Populated with both participants, for the thread and inbox views.
export const findByIdPopulated = (id) =>
  Conversation.findById(id)
    .populate("student", PARTICIPANT_FIELDS)
    .populate("faculty", PARTICIPANT_FIELDS);

export const create = (data) => Conversation.create(data);

export const save = (conversation) => conversation.save();

export const deleteById = (id) => Conversation.findByIdAndDelete(id);

// A user's inbox: every conversation they are a participant in, most-recently
// active first, with both participants populated for display.
export const findForUser = (userId) =>
  Conversation.find({ $or: [{ student: userId }, { faculty: userId }] })
    .sort({ lastMessageAt: -1 })
    .populate("student", PARTICIPANT_FIELDS)
    .populate("faculty", PARTICIPANT_FIELDS);
