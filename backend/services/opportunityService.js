import * as opportunityRepo from "../repositories/opportunityRepository.js";
import { AppError } from "../utils/AppError.js";
import * as storage from "../lib/storage/index.js";
import { attachmentKey } from "../lib/storage/keys.js";

// Service — business rules for the Opportunity domain.
// Controllers call into here; persistence happens via the repository.

// Loads an opportunity and asserts the requester is its owning faculty.
// Throws 404 if missing/deleted, 403 if owned by someone else.
const loadOwnedOpportunity = async (id, userId) => {
  const opportunity = await opportunityRepo.findById(id);

  if (!opportunity || opportunity.isDeleted) {
    throw new AppError("Opportunity not found", 404);
  }

  if (opportunity.postedBy.toString() !== userId) {
    throw new AppError("Unauthorized", 403);
  }

  return opportunity;
};

export const createOpportunity = (data, userId, organizationId) =>
  opportunityRepo.createOpportunity({
    title: data.title,
    description: data.description,
    category: data.category,
    postedBy: userId,
    organizationId,
    eligibleBranches: data.eligibleBranches?.length
      ? data.eligibleBranches
      : ["All"],
    eligibleYears: data.eligibleYears?.length ? data.eligibleYears : ["All"],
    eligibleGender: data.eligibleGender,
    contactEmail: data.contactEmail,
    tags: data.tags?.filter((tag) => tag.trim() !== "") || [],
    deadline: data.deadline,
  });

export const getActiveOpportunities = (organizationId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));

  const clean = (value) => (value && value !== "All" ? String(value).trim() : "");
  const filters = {
    search: query.search ? String(query.search).trim().slice(0, 100) : "",
    category: clean(query.category),
    branch: clean(query.branch),
    year: clean(query.year),
  };

  return opportunityRepo.findActiveOpportunities(organizationId, {
    page,
    limit,
    filters,
  });
};

export const getMyOpportunities = (userId) =>
  opportunityRepo.findByOwner(userId);

export const getOpportunityById = async (id, organizationId) => {
  const opportunity = await opportunityRepo.findByIdWithOwner(id, organizationId);

  if (!opportunity || opportunity.isDeleted) {
    throw new AppError("Opportunity not found", 404);
  }

  return opportunity;
};

export const updateOpportunity = async (id, userId, body) => {
  const opportunity = await loadOwnedOpportunity(id, userId);

  // Only persist fields that were actually sent.
  const updates = Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined)
  );

  // Deadline rules on edit: a deadline that is being *changed* must be in the
  // future; an *unchanged* deadline is left as-is even if it has already passed,
  // so the other fields of an expired opportunity can be edited without forcing
  // a re-date. A genuine change is also recorded for the audit trail.
  if (updates.deadline) {
    const nextDeadline = new Date(updates.deadline).getTime();
    const currentDeadline = new Date(opportunity.deadline).getTime();

    if (nextDeadline !== currentDeadline) {
      if (nextDeadline <= Date.now()) {
        throw new AppError("Deadline must be a future date", 400);
      }
      opportunity.deadlineHistory.push({
        previousDeadline: opportunity.deadline,
        extendedAt: new Date(),
        reason: "Updated while editing",
      });
    }
  }

  Object.assign(opportunity, updates);
  await opportunityRepo.save(opportunity);

  return opportunity;
};

export const softDeleteOpportunity = async (id, userId) => {
  const opportunity = await loadOwnedOpportunity(id, userId);

  opportunity.isDeleted = true;
  opportunity.deletedAt = new Date();
  await opportunityRepo.save(opportunity);
};

// Pause an opportunity while the faculty reviews applicants. Reversible.
export const archiveOpportunity = async (id, userId) => {
  const opportunity = await loadOwnedOpportunity(id, userId);

  if (opportunity.status === "Closed") {
    throw new AppError("A closed opportunity cannot be archived", 400);
  }

  opportunity.status = "Archived";
  await opportunityRepo.save(opportunity);
};

// Bring an archived opportunity back to Active. The faculty may keep the
// existing deadline or supply a new one. If the old deadline has already
// passed, a new (future) deadline is required.
export const unarchiveOpportunity = async (id, userId, { newDeadline } = {}) => {
  const opportunity = await loadOwnedOpportunity(id, userId);

  if (opportunity.status !== "Archived") {
    throw new AppError("Only archived opportunities can be reactivated", 400);
  }

  if (newDeadline) {
    if (new Date(newDeadline) <= new Date()) {
      throw new AppError("New deadline must be a future date", 400);
    }
    opportunity.deadlineHistory.push({
      previousDeadline: opportunity.deadline,
      extendedAt: new Date(),
      reason: "Reactivated with a new deadline",
    });
    opportunity.deadline = newDeadline;
  } else if (new Date(opportunity.deadline) <= new Date()) {
    throw new AppError(
      "This opportunity's deadline has passed. Please provide a new deadline to reactivate it.",
      400
    );
  }

  opportunity.status = "Active";
  await opportunityRepo.save(opportunity);

  return opportunity;
};

// Finalise an opportunity (e.g. position filled). Terminal state.
export const closeOpportunity = async (id, userId) => {
  const opportunity = await loadOwnedOpportunity(id, userId);

  opportunity.status = "Closed";
  await opportunityRepo.save(opportunity);
};

export const extendDeadline = async (id, userId, { newDeadline, reason }) => {
  const opportunity = await loadOwnedOpportunity(id, userId);

  if (new Date(newDeadline) <= new Date(opportunity.deadline)) {
    throw new AppError(
      "New deadline must be later than the current deadline",
      400
    );
  }

  opportunity.deadlineHistory.push({
    previousDeadline: opportunity.deadline,
    extendedAt: new Date(),
    reason: reason || "",
  });

  opportunity.deadline = newDeadline;
  await opportunityRepo.save(opportunity);

  return opportunity;
};

export const addAttachment = async (id, userId, file) => {
  const opportunity = await loadOwnedOpportunity(id, userId);

  if (!file) {
    throw new AppError("No file uploaded", 400);
  }

  const key = attachmentKey();
  await storage.put(key, { body: file.buffer, contentType: file.mimetype });

  opportunity.attachments.push({
    originalName: file.originalname,
    key,
    url: storage.publicUrl(key),
    uploadedAt: new Date(),
  });

  await opportunityRepo.save(opportunity);

  return opportunity.attachments[opportunity.attachments.length - 1];
};

export const deleteAttachment = async (id, userId, attachmentId) => {
  const opportunity = await loadOwnedOpportunity(id, userId);

  const attachment = opportunity.attachments.id(attachmentId);

  if (!attachment) {
    throw new AppError("Attachment not found", 404);
  }

  // The DB record is the source of truth: remove it first, then the object.
  const key = attachment.key || storage.keyFromPublicUrl(attachment.url);

  opportunity.attachments.pull(attachmentId);
  await opportunityRepo.save(opportunity);

  if (key) {
    try {
      await storage.remove(key);
    } catch (err) {
      console.error("Could not delete attachment object:", err.message);
    }
  }
};

export const getCategoryStats = (organizationId) =>
  opportunityRepo.aggregateCategoryStats(organizationId);
