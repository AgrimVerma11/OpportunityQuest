import pino from "pino";

// Structured logging, shared by the whole backend. JSON in production (what a
// log aggregator wants); colorized/human-readable in development. Silent in
// tests by default — NODE_ENV=test is already how the rest of the app (rate
// limiting, email, storage) recognizes the test harness, see tests/setup.js —
// so a test run's console stays clean unless LOG_LEVEL is set explicitly.
const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? "silent" : "info"),
  transport:
    isProd || isTest
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
});

export default logger;
