// Opportunity Quest — hot-path load test (k6)
//
// Ramps virtual users against the endpoints real traffic actually hits and
// reports p95 latency + error rate as the load climbs, so you can find the knee
// ("held 340 req/s at 180ms p95, then errors started").
//
// Weighted to mimic reality: the notification-badge poll dominates, then feed
// browsing, then the health check. Read-only — it never writes data, so it is
// safe to point at any running instance (subject to the rate-limit note below).
//
// ── IMPORTANT: the rate limiter ──────────────────────────────────────────────
// The API caps 300 requests / 15 min / IP. From one machine you'll blow through
// that in seconds and see 429s — that measures the limiter, not capacity. For a
// real throughput number, run against an instance with the limiter off (see
// loadtest/README.md). The `rate_limited_429` counter below tells you if that's
// what you're seeing.
//
// Run:
//   BASE_URL=http://localhost:5174/api TEST_EMAIL=you@thapar.edu TEST_PASSWORD=… \
//     k6 run loadtest/hot-path.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5174/api";
const EMAIL = __ENV.TEST_EMAIL || "";
const PASSWORD = __ENV.TEST_PASSWORD || "";
const PEAK = Number(__ENV.PEAK_VUS || 200); // top of the ramp; raise to push harder

// Per-endpoint latency, so you can see which one bends first.
const feedLatency = new Trend("feed_latency", true);
const unreadLatency = new Trend("unread_latency", true);
const healthLatency = new Trend("health_latency", true);
const rateLimited = new Counter("rate_limited_429");
const errors = new Rate("errors");

export const options = {
  stages: [
    { duration: "30s", target: Math.round(PEAK * 0.1) },
    { duration: "1m", target: Math.round(PEAK * 0.25) },
    { duration: "1m", target: Math.round(PEAK * 0.5) },
    { duration: "1m", target: PEAK },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"], // fewer than 1% failed requests
    http_req_duration: ["p(95)<800"], // 95% of requests under 800ms
  },
};

// Runs once. Logs in to get a token the VUs share (all read traffic looks like
// one signed-in user — fine, since the DB/CPU work is the same either way).
export function setup() {
  if (!EMAIL || !PASSWORD) {
    console.warn("No TEST_EMAIL / TEST_PASSWORD set — hitting public endpoints only.");
    return { token: null };
  }
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  );
  const token = res.json("data.token");
  if (!token) {
    console.error(`Login failed (HTTP ${res.status}); hitting public endpoints only.`);
    return { token: null };
  }
  return { token };
}

export default function (data) {
  const authed = data.token
    ? { headers: { Authorization: `Bearer ${data.token}` } }
    : null;

  const roll = Math.random();

  if (authed && roll < 0.5) {
    // The dominant real request: the notification badge poll.
    const r = http.get(`${BASE_URL}/notifications/unread-count`, {
      headers: authed.headers,
      tags: { name: "unread-count" },
    });
    unreadLatency.add(r.timings.duration);
    record(r);
  } else if (authed && roll < 0.85) {
    // Browsing the feed.
    const r = http.get(`${BASE_URL}/opportunities?page=1&limit=12`, {
      headers: authed.headers,
      tags: { name: "feed" },
    });
    feedLatency.add(r.timings.duration);
    record(r);
  } else {
    // Public health check.
    const r = http.get(`${BASE_URL}/health`, { tags: { name: "health" } });
    healthLatency.add(r.timings.duration);
    record(r);
  }

  // Think time — real users pause. Lower this (or remove it) to push max RPS.
  sleep(Math.random() * 1.5 + 0.5); // 0.5–2s
}

function record(r) {
  if (r.status === 429) rateLimited.add(1);
  errors.add(r.status >= 400);
  check(r, { "status < 400": (res) => res.status < 400 });
}
