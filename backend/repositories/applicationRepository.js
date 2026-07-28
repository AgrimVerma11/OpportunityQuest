import Application from "../models/Application.js";

// Repository — the only place that talks to the Application collection.

export const create = (data) => Application.create(data);

export const findById = (id) => Application.findById(id);

// Populated for detail views: full applicant profile + the parent opportunity.
export const findByIdPopulated = (id) =>
  Application.findById(id)
    .populate(
      "student",
      "name email branch year gender skills society projects interests profileImage bio linkedinUrl role"
    )
    .populate("opportunity", "title category postedBy deadline status");

export const findOne = (filter) => Application.findOne(filter);

// A student's own applications, newest first.
export const findByStudent = (studentId) =>
  Application.find({ student: studentId })
    .populate("opportunity", "title category deadline status isDeleted")
    .sort({ createdAt: -1 });

// Applicants for one opportunity, optionally filtered by status.
export const findByOpportunity = (opportunityId, status) => {
  const filter = { opportunity: opportunityId };
  if (status) filter.status = status;
  return Application.find(filter)
    .populate("student", "name email branch year gender skills profileImage")
    .sort({ createdAt: -1 });
};

export const save = (application) => application.save();
