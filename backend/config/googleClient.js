import { OAuth2Client } from "google-auth-library";

// Verifies a Google ID token — the credential the frontend receives from Google
// Identity Services — and returns the claims we rely on. Isolated here so the
// audience check and the library live in one place, and so it can be mocked in
// tests without a real Google round-trip.
const client = new OAuth2Client();

export const verifyGoogleCredential = async (credential) => {
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  return {
    email: (payload.email || "").toLowerCase().trim(),
    emailVerified: payload.email_verified === true,
    name: payload.name || "",
    googleId: payload.sub,
  };
};
