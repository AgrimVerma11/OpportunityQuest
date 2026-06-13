import User from "../models/User.js";

// User data access used outside the auth flow (e.g. eligibility checks and
// application analytics).

export const findById = (id) => User.findById(id);

export const incrementApplicationsSubmitted = (id, delta) =>
  User.findByIdAndUpdate(id, { $inc: { applicationsSubmitted: delta } });
