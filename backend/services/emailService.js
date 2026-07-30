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

export const notifyFacultyApproved = (user) =>
  bestEffort("faculty-approval", user.email, () =>
    templates.facultyApproval({ name: user.name })
  );

export const notifyFacultyRejected = (user, reason) =>
  bestEffort("faculty-rejection", user.email, () =>
    templates.facultyRejection({ name: user.name, reason })
  );
