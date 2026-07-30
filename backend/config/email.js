// Email configuration. The app sends mail through a provider port (see
// lib/email); this module decides which provider backs it and, for a real
// provider, fails fast at startup if a credential is missing rather than at the
// first send. The default provider is "log" — it writes emails to the console
// instead of sending them — so local development and the test suite need no
// account and no network.

const provider = (process.env.EMAIL_PROVIDER || "log").toLowerCase();

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `EMAIL_PROVIDER=${provider} requires ${name}. Set it, or use EMAIL_PROVIDER=log.`
    );
  }
  return value;
};

let config;

if (provider === "resend") {
  config = {
    provider: "resend",
    apiKey: required("RESEND_API_KEY"),
    // e.g. "Opportunity Quest <onboarding@resend.dev>"
    from: required("EMAIL_FROM"),
  };
} else if (provider === "log") {
  config = {
    provider: "log",
    from: process.env.EMAIL_FROM || "Opportunity Quest <noreply@opportunityquest.local>",
  };
} else {
  throw new Error(`Unknown EMAIL_PROVIDER "${provider}". Use "log" or "resend".`);
}

export default config;
