import * as emailTransport from "../lib/email/index.js";
import * as templates from "../lib/email/templates.js";

// Domain email senders. These are deliberately BEST-EFFORT: an email is a side
// effect of an action, never a precondition for it. Every sender swallows its
// own errors so a mail failure can neither throw into nor delay the request
// that triggered it. Callers fire-and-forget them after the real work commits.

const bestEffort = async (label, to, build) => {
  try {
    const { subject, html, text } = build();
    await emailTransport.sendEmail({ to, subject, html, text });
  } catch (err) {
    console.error(`Failed to send ${label} email to ${to}:`, err.message);
  }
};

// Turns an in-app link (e.g. "/my-applications") into an absolute URL the email
// can link back to.
const appUrl = (link) => {
  const base = process.env.ALLOWED_ORIGIN || "http://localhost:5173";
  return link ? `${base}${link}` : base;
};

export const notifyFacultyApproved = (user) =>
  bestEffort("faculty-approval", user.email, () =>
    templates.facultyApproval({ name: user.name })
  );

export const notifyFacultyRejected = (user, reason) =>
  bestEffort("faculty-rejection", user.email, () =>
    templates.facultyRejection({ name: user.name, reason })
  );

// The email nudge for an in-app notification (used by notificationService).
export const sendNotificationEmail = (to, { title, body, link }) =>
  bestEffort("notification", to, () =>
    templates.notification({ title, body, actionUrl: appUrl(link) })
  );
