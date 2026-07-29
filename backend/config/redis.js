import Redis from "ioredis";

// A shared Redis client for state that must be consistent across backend
// instances — today, rate-limit counters. It is created only when REDIS_URL is
// set; without it the app runs fine and those features fall back to a local
// default (in-memory limiting). Upstash hands out a rediss:// URL and ioredis
// negotiates TLS from the scheme, so no extra config is needed.

let redisClient = null;

if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    // Fail fast when Redis is unreachable so callers (the rate limiter) can
    // degrade immediately rather than hang on a queued command.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2,
    // Reconnect with a capped backoff.
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  // Without an "error" listener ioredis can surface a connection failure as an
  // uncaught exception. The app must never crash because the cache is down, so
  // log and carry on — and de-duplicate so a persistent outage doesn't spam.
  let lastError = null;
  redisClient.on("error", (err) => {
    if (err.message !== lastError) {
      console.error("Redis client error:", err.message);
      lastError = err.message;
    }
  });
  redisClient.on("ready", () => {
    lastError = null;
    console.log("Redis connected");
  });
}

export const isRedisEnabled = Boolean(redisClient);

export default redisClient;
