# Load testing

Two [k6](https://k6.io) scripts, both read-only (they never write data):

- **`hot-path.js`** — the student-facing surface: the notification poll, the
  feed, and health.
- **`admin-analytics.js`** — the coordinator dashboard: the bundled analytics
  payload, the funnel, and the faculty engagement leaderboard. Needs a
  coordinator account (`TEST_EMAIL`/`TEST_PASSWORD` are required, not
  optional, for this one).

Both report p95 latency and error rate as load climbs. Everything below
applies to either — just swap the script name.

## Install k6

```bash
brew install k6            # macOS
# or: https://grafana.com/docs/k6/latest/set-up/install-k6/
```

## The one thing that will trip you up: the rate limiter

The API caps **300 requests / 15 min / IP** (`/api/auth` is 20/15min). A load
test from a single machine burns through 300 requests in seconds and then gets
`429`s for the rest of the window — you'd be measuring the limiter, not
throughput. Watch the `rate_limited_429` metric in the output; if it's climbing,
that's what's happening.

So there are two useful runs, for two different questions.

### A. True capacity — recommended

Measure what the code + one instance can actually do, with the limiter out of
the way. Run the API **locally against a throwaway database** (never production),
seed it, and disable the limiter — it already skips itself when `NODE_ENV=test`:

```bash
# 1. Point at a local/throwaway Mongo and seed some opportunities to page through
cd backend
MONGO_URI="mongodb://127.0.0.1:27017/oq-loadtest" npm run seed

# 2. Start the API with the limiter off
NODE_ENV=test PORT=5174 MONGO_URI="mongodb://127.0.0.1:27017/oq-loadtest" node server.js

# 3. In another terminal, ramp it (register/seed a student first, or omit creds
#    to test public endpoints only)
BASE_URL=http://localhost:5174/api \
TEST_EMAIL=student@thapar.edu TEST_PASSWORD=password123 \
PEAK_VUS=400 \
k6 run loadtest/hot-path.js

# Or, for the coordinator dashboard (use a coordinator account):
BASE_URL=http://localhost:5174/api \
TEST_EMAIL=coordinator@thapar.edu TEST_PASSWORD=password123 \
PEAK_VUS=30 \
k6 run loadtest/admin-analytics.js
```

This gives a clean throughput ceiling for one Node process on your machine — a
reasonable proxy for one Render instance (production instances are usually a bit
smaller, so treat the number as an optimistic single-instance figure).

### B. Production reality check — keep it tiny

Point it at the live API at low VUs, off-hours, to confirm real-world latency and
see the limiter engage:

```bash
BASE_URL=https://api.opportunityquest.agrimverma.dev/api \
TEST_EMAIL=you@thapar.edu TEST_PASSWORD=… \
PEAK_VUS=10 \
k6 run loadtest/hot-path.js
```

Expect `rate_limited_429` to start climbing quickly — that's the limiter doing
its job. **Don't run a big ramp against production**: it degrades the app for
real users and burns your Atlas/Upstash quotas.

## Reading the output

k6 prints a summary. The lines that matter:

- **`http_req_duration … p(95)`** — the number to quote. "p95 = 180ms" means 95%
  of requests finished within 180ms.
- **`http_req_failed`** — error rate. Below ~1% while p95 stays flat = healthy.
- **`iterations` / `http_reqs` per second** — your throughput (req/s).
- **`feed_latency` / `unread_latency` / `health_latency`** (hot-path.js) or
  **`overview_latency` / `funnel_latency` / `faculty_activity_latency`**
  (admin-analytics.js) — which endpoint bends first under load.
- **`rate_limited_429`** — should be ~0 in run A; non-zero means the limiter is
  capping you (expected in run B).

Ramp `PEAK_VUS` up until p95 climbs sharply or errors appear — that inflection is
your knee. Report it as, e.g., "held ~340 req/s at 180ms p95, degraded past 500
VUs."

## Config

| Env | Default | Meaning |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:5174/api` | API base (include `/api`) |
| `TEST_EMAIL` / `TEST_PASSWORD` | — | a real account; omit to test public endpoints only |
| `PEAK_VUS` | `200` (`hot-path.js`) / `30` (`admin-analytics.js`) | top of the ramp — raise to push harder |

## The campus-NAT rate-limit failure mode — already handled

The limiter is keyed by **user id when a request carries a valid token**
(`identifyForRateLimit.js`/`byUserThenIp` in `rateLimiters.js`), falling back to
IP only for unauthenticated requests. So many students sharing one NAT'd IP on
a campus network no longer share a single budget — this was previously a real
gap (see git history) and is now closed. `/api/auth` stays IP-keyed, which is
correct: there's no user identity yet at login/register.
