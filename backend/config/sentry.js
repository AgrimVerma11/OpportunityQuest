import * as Sentry from "@sentry/node";

import logger from "./logger.js";

// Optional, same fail-open posture as the Redis client (config/redis.js): the
// app works fully without SENTRY_DSN set, it just has no error tracking. Call
// initSentry() once at startup, before the app begins handling requests.
export const initSentry = () => {
  if (!process.env.SENTRY_DSN) return false;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    // Sampled, not exhaustive — this is error tracking, not a full tracing
    // rollout; a low sample rate is enough to catch a real problem without
    // paying full per-request overhead.
    tracesSampleRate: 0.1,
  });
  return true;
};

// Reports an unexpected (5xx-class) error. Routine, expected failures —
// AppError instances a controller already turned into a clean 4xx — are not
// sent here; those are user-facing conditions, not bugs. A no-op when Sentry
// was never initialized.
export const captureException = (err) => {
  if (!process.env.SENTRY_DSN) return;
  try {
    Sentry.captureException(err);
  } catch (captureErr) {
    // Error tracking must never be the reason a request fails.
    logger.error({ err: captureErr }, "Sentry capture failed");
  }
};
