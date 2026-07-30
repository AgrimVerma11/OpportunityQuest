import config from "../../config/email.js";
import * as log from "./logProvider.js";
import * as resend from "./resendProvider.js";

// The email transport port. Callers pass a message; which provider actually
// delivers it (a real service in production, a console line in development) is a
// single configuration switch. This is the low-level surface — it throws on
// failure. Domain callers should go through services/emailService.js, which
// sends best-effort and never lets an email failure break the request.

const provider = config.provider === "resend" ? resend : log;

export const sendEmail = ({ to, subject, html, text }) =>
  provider.send({ from: config.from, to, subject, html, text });
