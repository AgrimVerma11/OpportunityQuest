import { Resend } from "resend";

import config from "../../config/email.js";

// Resend transactional email. The client is created lazily so importing this
// module under the log provider (tests, development) never touches the API key.
let client;
const resend = () => {
  if (!client) client = new Resend(config.apiKey);
  return client;
};

export const send = async ({ from, to, subject, html, text }) => {
  const { error } = await resend().emails.send({
    from,
    to,
    subject,
    html,
    text,
  });
  // The SDK reports failures on `error` rather than throwing; surface it so the
  // caller's best-effort wrapper can log it.
  if (error) {
    throw new Error(error.message || "Resend failed to send the email");
  }
};
