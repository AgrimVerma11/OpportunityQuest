// Notification types and their delivery policy. In-app delivery is implicit for
// every type; EMAIL_NUDGE_TYPES additionally sends an email so a time-sensitive
// notification isn't missed while the user is away. Application-received is
// deliberately in-app only — it can fire often, and an inbox full of "new
// applicant" mail would train people to ignore it.

export const NOTIFICATION_TYPES = {
  APPLICATION_STATUS: "application.status",
  APPLICATION_RECEIVED: "application.received",
  FACULTY_PENDING: "faculty.pending",
  MESSAGE_RECEIVED: "message.received",
};

export const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPES);

// Types that also send an email nudge.
const EMAIL_NUDGE_TYPES = new Set([
  NOTIFICATION_TYPES.APPLICATION_STATUS,
  NOTIFICATION_TYPES.FACULTY_PENDING,
  NOTIFICATION_TYPES.MESSAGE_RECEIVED,
]);

export const shouldEmail = (type) => EMAIL_NUDGE_TYPES.has(type);
