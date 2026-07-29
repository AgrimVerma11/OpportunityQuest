// Audit actions — the vocabulary of the append-only audit trail. Values are
// namespaced "<domain>.<verb>" so the set can grow to other admin actions
// (suspensions, role changes) without ambiguity.

export const AUDIT_ACTIONS = {
  FACULTY_APPROVED: "faculty.approved",
  FACULTY_REJECTED: "faculty.rejected",
};

export const AUDIT_ACTION_VALUES = Object.values(AUDIT_ACTIONS);
