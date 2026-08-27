import rateLimit from "express-rate-limit";
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

// Applied to the whole API — a generous ceiling that only trips on abuse.
export const apiLimiter = buildLimiter({
  prefix: "rl:api:",
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  handler: jsonResponse("Too many requests. Please try again later."),
});

// Stricter limit on auth endpoints to slow brute-force / credential stuffing.
export const authLimiter = buildLimiter({
  prefix: "rl:auth:",
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  handler: jsonResponse(
    "Too many authentication attempts. Please try again in a few minutes."
  ),
});

// Guards the apply endpoint against rapid-fire submissions.
export const applyLimiter = buildLimiter({
  prefix: "rl:apply:",
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  handler: jsonResponse(
    "Too many application attempts. Please try again in a few minutes."
  ),
});

// Account creation is the scarcest, most abuse-prone action: a script could
// otherwise register accounts in bulk and bloat the database. This is far
// stricter than the shared auth limit and applies only to the register route.
// Keyed per IP — a campus NAT shares one budget, so this is generous enough for
// a normal onboarding burst but low enough to stop automated sign-up spam.
// Tune `max` up if a large cohort registers from one network in a short window.
export const registerLimiter = buildLimiter({
  prefix: "rl:register:",
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  handler: jsonResponse(
    "Too many accounts created from this network. Please try again later."
  ),
});
