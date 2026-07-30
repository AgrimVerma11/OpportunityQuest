// Application domain constants — status values, the legal transition graph,
// the statuses a faculty member may set, and the re-apply cooldown.

export const APPLICATION_STATUS = {
  APPLIED: "Applied",
  VIEWED: "Viewed",
  SHORTLISTED: "Shortlisted",
  SELECTED: "Selected",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export const APPLICATION_STATUSES = Object.values(APPLICATION_STATUS);

// Statuses a faculty member may assign through the status endpoint.
// "Viewed" is set automatically when an applicant is opened, not manually.
export const FACULTY_SETTABLE_STATUSES = [
  APPLICATION_STATUS.SHORTLISTED,
  APPLICATION_STATUS.SELECTED,
  APPLICATION_STATUS.REJECTED,
];

// Legal transitions, enforced server-side. Terminal states have no outgoing
// edges. The list is the set of statuses reachable from the keyed status.
export const STATUS_TRANSITIONS = {
  [APPLICATION_STATUS.APPLIED]: [
    APPLICATION_STATUS.VIEWED,
    APPLICATION_STATUS.SHORTLISTED,
    APPLICATION_STATUS.REJECTED,
  ],
  [APPLICATION_STATUS.VIEWED]: [
    APPLICATION_STATUS.SHORTLISTED,
    APPLICATION_STATUS.REJECTED,
  ],
  [APPLICATION_STATUS.SHORTLISTED]: [
    APPLICATION_STATUS.SELECTED,
    APPLICATION_STATUS.REJECTED,
  ],
  [APPLICATION_STATUS.SELECTED]: [],
  [APPLICATION_STATUS.REJECTED]: [],
  [APPLICATION_STATUS.WITHDRAWN]: [],
};

// Statuses a student may withdraw from.
export const WITHDRAWABLE_STATUSES = [
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.VIEWED,
  APPLICATION_STATUS.SHORTLISTED,
];

// Statuses in which an application's conversation is open for messaging. A
// conversation may be started (by faculty) and sent to only while the
// application is here; outside it (Rejected/Withdrawn) the thread is read-only.
export const MESSAGEABLE_STATUSES = [
  APPLICATION_STATUS.SHORTLISTED,
  APPLICATION_STATUS.SELECTED,
];

// Hours a student must wait after withdrawing before re-applying.
export const REAPPLY_COOLDOWN_HOURS = 6;
