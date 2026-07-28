import Organization from "../models/Organization.js";

// Repository — the only place that talks to the Organization collection.

export const findByEmailDomain = (domain) =>
  Organization.findOne({
    emailDomains: domain.toLowerCase(),
    isActive: true,
  });

export const findById = (id) => Organization.findById(id);

export const create = (data) => Organization.create(data);
