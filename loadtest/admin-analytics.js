// Opportunity Quest — coordinator analytics load test (k6)
//
// Same shape and rate-limit caveat as hot-path.js (read this file's sibling
// README first) — this one targets the coordinator dashboard specifically,
// since that surface has never actually been load-tested despite carrying
// the heaviest aggregation queries in the app.
//
// Needs a COORDINATOR account, not a student one.
//
// Run:
//   BASE_URL=http://localhost:5174/api \
//   TEST_EMAIL=coordinator@thapar.edu TEST_PASSWORD=… \
//     k6 run loadtest/admin-analytics.js
//
// Default PEAK_VUS is much lower than hot-path.js's — realistically there are
// a handful of coordinators per institution, not hundreds of students. Raise
// it if you want to see where it actually bends, not just confirm it's fine
// at realistic load.

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5174/api";
const EMAIL = __ENV.TEST_EMAIL || "";
const PASSWORD = __ENV.TEST_PASSWORD || "";
const PEAK = Number(__ENV.PEAK_VUS || 30);

const overviewLatency = new Trend("overview_latency", true);
const funnelLatency = new Trend("funnel_latency", true);
const facultyActivityLatency = new Trend("faculty_activity_latency", true);
const rateLimited = new Counter("rate_limited_429");
const errors = new Rate("errors");

export const options = {
  stages: [
    { duration: "20s", target: Math.round(PEAK * 0.2) },
    { duration: "40s", target: Math.round(PEAK * 0.5) },
    { duration: "40s", target: PEAK },
    { duration: "20s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    // The bundled /admin/analytics payload runs several aggregations in
    // parallel — looser than hot-path.js's 800ms, since this is intentionally
    // heavier work, not a cheap read.
    http_req_duration: ["p(95)<1500"],
  },
};

export function setup() {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      "TEST_EMAIL / TEST_PASSWORD required — this suite only exercises coordinator-only routes."
    );
  }
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  );
  const token = res.json("data.token");
  if (!token) {
    throw new Error(`Login failed (HTTP ${res.status}) — check TEST_EMAIL/TEST_PASSWORD.`);
  }
  return { token };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };
  const roll = Math.random();

  if (roll < 0.5) {
    // The bundled payload — what actually loads when a coordinator opens the
    // dashboard. The single heaviest request on this surface.
    const r = http.get(`${BASE_URL}/admin/analytics`, { headers, tags: { name: "overview" } });
    overviewLatency.add(r.timings.duration);
    record(r);
  } else if (roll < 0.8) {
    // Clicking a category chip on the funnel.
    const r = http.get(`${BASE_URL}/admin/analytics/funnel?category=Research`, {
      headers,
      tags: { name: "funnel" },
    });
    funnelLatency.add(r.timings.duration);
    record(r);
  } else {
    // Switching the faculty-engagement leaderboard to Year to Date.
    const r = http.get(`${BASE_URL}/admin/analytics/faculty-activity?mode=ytd`, {
      headers,
      tags: { name: "faculty-activity" },
    });
    facultyActivityLatency.add(r.timings.duration);
    record(r);
  }

  // A coordinator dashboard isn't polled like the notification badge — a
  // longer, more human think time between actions.
  sleep(Math.random() * 3 + 1); // 1–4s
}

function record(r) {
  if (r.status === 429) rateLimited.add(1);
  errors.add(r.status >= 400);
  check(r, { "status < 400": (res) => res.status < 400 });
}
