import jwt from "jsonwebtoken";

// Best-effort identity for rate-limiting only — never for authorization. Tries
// to decode a Bearer token, ahead of any route's real authMiddleware, purely so
// apiLimiter can key its counter by user instead of IP (see rateLimiters.js's
// byUserThenIp). A missing, malformed, expired, or invalid-signature token is
// not an error here: the request simply proceeds with no identity attached,
// falls back to IP-based limiting, and — if the route actually requires
// auth — is still correctly rejected downstream by the real authMiddleware.
// Deliberately writes to a separate field, never req.user, so this can never
// be mistaken for authentication.
const identifyForRateLimit = (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme === "Bearer" && token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.rateLimitUserId = decoded.id;
    } catch {
      /* not our concern here — the real authMiddleware handles a bad token */
    }
  }
  next();
};

export default identifyForRateLimit;
