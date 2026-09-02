import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

import redisClient from "../config/redis.js";
import { ResilientStore } from "./resilientStore.js";

const jsonResponse = (message) => (req, res) =>
  res.status(429).json({ success: false, message });

// Rate limiting is bypassed under the test runner so integration tests can
// drive the auth/apply flows repeatedly without tripping the ceilings.
const skipInTest = () => process.env.NODE_ENV === "test";

// When Redis is configured, counters live there so every backend instance
// shares one limit — the point of this slice. The Redis store is wrapped so a
// Redis outage fails open rather than taking the API down. Without Redis the
// store option is omitted and express-rate-limit uses its per-process in-memory
// store, which is fine for a single instance and for local development. Each
// limiter gets its own key prefix so their counters never collide.
const redisStore = (prefix) =>
  redisClient
    ? new ResilientStore(
        new RedisStore({
          sendCommand: (...args) => redisClient.call(...args),
          prefix,
        })
      )
    : undefined;

const buildLimiter = ({ prefix, ...options }) => {
  const store = redisStore(prefix);
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    ...options,
    ...(store ? { store } : {}),
  });
};

// Keys a limiter by the authenticated user when one is known — either the real
// req.user (routes mounted after authMiddleware) or the best-effort
// req.rateLimitUserId (see middleware/identifyForRateLimit.js, used ahead of
// limiters that run before any route-level auth). Falls back to IP so an
// unauthenticated request is still bounded. Using the library's own
// ipKeyGenerator (not raw req.ip) is required for correct, ungameable IPv6
// handling in a custom key generator. Exported (not just used inline) so its
// keying logic is directly unit-testable without needing a live, un-skipped
// limiter — the same technique already used for ResilientStore.
export const byUserThenIp = (req) =>
  req.user?.id || req.rateLimitUserId || ipKeyGenerator(req.ip);

// Keys login attempts by the attempted account (email), falling back to IP if
// the body has no usable email. See the loginLimiter comment below for the
// full two-counter rationale. Exported for the same direct-testability reason
// as byUserThenIp.
export const loginKeyGenerator = (req) => {
  const email = String(req.body?.email || "")
    .toLowerCase()
    .trim();
  return email || ipKeyGenerator(req.ip);
};

// Applied to the whole API — a generous ceiling that only trips on abuse.
// Keyed by user when the request carries a decodable token (see
// identifyForRateLimit, wired ahead of this in app.js), so a shared campus IP
// no longer means a shared budget for everyone on it; falls back to IP for
// anonymous requests.
export const apiLimiter = buildLimiter({
  prefix: "rl:api:",
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  keyGenerator: byUserThenIp,
  handler: jsonResponse("Too many requests. Please try again later."),
});

// Stricter limit on the whole auth surface (login, register, google, profile)
// to slow brute-force / credential stuffing. Necessarily IP-keyed — there is
// no account identity to key by until a request tells us which one it means,
// and this limiter runs ahead of that. Login gets an additional, account-keyed
// limiter below; this one remains as the broad, network-level backstop.
export const authLimiter = buildLimiter({
  prefix: "rl:auth:",
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  handler: jsonResponse(
    "Too many authentication attempts. Please try again in a few minutes."
  ),
});

// A second, ACCOUNT-keyed limiter on login specifically, stacked alongside
// (never replacing) the IP-keyed authLimiter above. Two different threats, two
// different keys:
//   - authLimiter (IP)    catches one attacker spraying many accounts fast.
//   - loginLimiter (email) catches one account being targeted slowly from many
//                          IPs — the case IP-keying can never catch — and,
//                          just as important, stops a shared campus IP's login
//                          attempts on *different* students' *own* accounts
//                          from ever competing for one budget.
// Keying by email does open a narrow, accepted trade-off: someone could
// deliberately fail a specific victim's login repeatedly to grief them for the
// 15-minute window. That's a real but low-severity, temporary annoyance — the
// standard, industry-accepted cost of account-keyed brute-force limiting — and
// is why the max stays generous (20, matching authLimiter) rather than tight.
// Falls back to IP if the body has no usable email, so a malformed request
// can't dodge limiting entirely by omitting the field.
export const loginLimiter = buildLimiter({
  prefix: "rl:login:",
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  keyGenerator: loginKeyGenerator,
  handler: jsonResponse(
    "Too many login attempts for this account. Please try again in a few minutes."
  ),
});

// Guards the apply endpoint against rapid-fire submissions. Runs after
// authMiddleware in every route that uses it, so req.user.id is always a real,
// server-verified identity — keying by it means two students behind one
// campus IP no longer share one apply budget.
export const applyLimiter = buildLimiter({
  prefix: "rl:apply:",
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  keyGenerator: (req) => req.user.id,
  handler: jsonResponse(
    "Too many application attempts. Please try again in a few minutes."
  ),
});

// Account creation is the scarcest, most abuse-prone action: a script could
// otherwise register accounts in bulk and bloat the database. This is far
// stricter than the shared auth limit and applies only to the register route.
// Deliberately kept IP-keyed, not user-keyed: there is no account yet to key
// by, and the whole point of this limiter is bounding how many accounts one
// network can create — a genuinely network-scoped question, not a per-user one.
// Generous enough for a normal onboarding burst but low enough to stop
// automated sign-up spam. Tune `max` up if a large cohort registers from one
// network in a short window.
export const registerLimiter = buildLimiter({
  prefix: "rl:register:",
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  handler: jsonResponse(
    "Too many accounts created from this network. Please try again later."
  ),
});

// Bounds consequential faculty/coordinator mutations — posting, editing,
// archiving or extending an opportunity, uploading/removing an attachment,
// moving an applicant's status, and (see adminRoutes.js) banning, unbanning or
// removing an account. Every route this is wired to runs after authMiddleware,
// so req.user.id is always real and server-verified. 60/15min is well above
// any real workflow — it exists purely to bound a compromised or malicious
// account, not to slow down normal use.
export const facultyActionLimiter = buildLimiter({
  prefix: "rl:faction:",
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  keyGenerator: (req) => req.user.id,
  handler: jsonResponse("Too many changes in a short time. Please slow down."),
});
