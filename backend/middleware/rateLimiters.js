import rateLimit from "express-rate-limit";

const jsonResponse = (message) => (req, res) =>
  res.status(429).json({ success: false, message });

// Applied to the whole API — a generous ceiling that only trips on abuse (later on will be tightened even further - note -> google auth to be added).
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonResponse("Too many requests. Please try again later."),
});

// Stricter limit on auth endpoints to slow brute-force / credential stuffing.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonResponse(
    "Too many authentication attempts. Please try again in a few minutes."
  ),
});
