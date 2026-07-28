// User roles and the account-status lifecycle.

export const ROLES = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  COORDINATOR: "Coordinator",
  SUPERADMIN: "SuperAdmin",
};

export const USER_ROLES = Object.values(ROLES);

// Roles a person may choose when self-registering. Coordinator and SuperAdmin
// are provisioned by the tier above them, never self-assigned.
export const SELF_REGISTERABLE_ROLES = [ROLES.STUDENT, ROLES.FACULTY];

export const ACCOUNT_STATUS = {
  PENDING: "Pending",
  ACTIVE: "Active",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

export const ACCOUNT_STATUSES = Object.values(ACCOUNT_STATUS);
