import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "./Navbar";
import PageHero from "../components/PageHero";
import Avatar from "../components/Avatar";
import Tag from "../components/Tag";
import StatCard from "../components/StatCard";
import UrgencyChip from "../components/UrgencyChip";
import Button from "../components/Button";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import ProfileModal from "../components/ProfileModal";
import Modal from "../components/Modal";
import Field from "../components/Field";
import { useConfirm } from "../components/ConfirmProvider";
import { useToast } from "../components/ToastProvider";
import {
  IconAlert,
  IconTrash,
  IconClock,
  IconUser,
  IconFile,
  IconInbox,
  IconCheck,
  IconArrowLeft,
  IconArrowRight,
  IconChevronDown,
} from "../components/Icons";
import { fetchWithAuth, patchWithAuth, deleteWithAuth } from "../utils/api";
import "./Analytics.css";

// The sequential application funnel — outcomes that sit outside it (Rejected,
// Withdrawn) are shown separately, not as stages someone "converts" through.
const FUNNEL_STAGES = ["Applied", "Viewed", "Shortlisted", "Selected"];
const CATEGORY_ORDER = ["Internship", "Research", "Paid Gig", "Faculty Project"];
const OPPORTUNITY_STATUS_ORDER = ["Active", "Expired", "Archived", "Closed"];
const CLOSING_SOON_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Whole days between now and an ISO deadline (negative once it's passed).
const daysUntil = (iso) => Math.floor((new Date(iso).getTime() - Date.now()) / DAY_MS);

const TABS = ["Overview", "Opportunities", "Faculty", "Students"];

// "Mon YYYY" tokens, matching the backend's faculty-activity month format
// exactly (see MONTH_TOKEN in backend/validators/adminValidator.js) — built
// from the current date rather than hardcoded, so the picker stays current.
// UTC throughout, matching how the backend parses these tokens.
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const monthToken = (date) => `${MONTH_ABBR[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
const recentMonths = (n) => {
  const out = [];
  const d = new Date();
  d.setUTCDate(1); // avoid month-length rollover when stepping backward
  for (let i = 0; i < n; i += 1) {
    out.push(monthToken(d));
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out; // most recent first
};

const RANGE_MODES = [
  { value: "month", label: "Month" },
  { value: "ytd", label: "Year to Date" },
  { value: "custom", label: "Custom Range" },
];
const TOP_N_OPTIONS = [3, 5, 10, 25];

const SORT_OPTIONS = [
  { value: "default", label: "Newest" },
  { value: "deadline", label: "Nearest deadline" },
  { value: "applications", label: "Fewest applications" },
];

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

const toneOf = (label) => label.toLowerCase().replace(/\s+/g, "-");

const TREND_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-08-03" → "Aug 3", parsed from parts so it never shifts by a timezone.
const trendDate = (iso) => {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${TREND_MONTHS[m - 1]} ${d}`;
};
const TREND_PERIODS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];
const TREND_SERIES = [
  { value: "applications", label: "Applications" },
  { value: "signups", label: "Signups" },
  { value: "postings", label: "Postings" },
];

// A labelled horizontal bar, colored by its `tone` and sized to the section
// max. `caption`, if given, renders as a small muted line under the label
// (e.g. "5 postings") — used where the bar value alone doesn't say enough.
function BarRow({ label, value, max, tone, caption }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={`an-bar-row${caption ? " an-bar-row--captioned" : ""}`}>
      <span className="an-bar-label" title={label}>
        {label}
        {caption && <span className="an-bar-caption">{caption}</span>}
      </span>
      <span className="an-bar-track">
        <span
          className={`an-bar-fill ${tone}`}
          style={{ width: `${Math.max(value > 0 ? 6 : 0, pct)}%` }}
        />
      </span>
      <span className="an-bar-value">{value}</span>
    </div>
  );
}

export default function Analytics() {
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState("Overview");
  const [viewUserId, setViewUserId] = useState(null); // students: generic ProfileModal
  const [viewFacultyId, setViewFacultyId] = useState(null); // faculty: FacultyDetailModal

  // Filter carried into the Opportunities tab — set directly when switching
  // tabs manually (defaults) or via a drill-down click from Overview (Needs
  // Attention rows, the status tiles, the Active Opportunities KPI).
  const [oppFilter, setOppFilter] = useState({ status: "All", sort: "default" });
  const openOpportunities = useCallback((status, sort = "default") => {
    setOppFilter({ status, sort });
    setTab("Opportunities");
  }, []);

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [faculty, setFaculty] = useState(null);
  // The Students tab owns its own (paginated, filterable) data entirely —
  // this just tells it "something changed, refetch whatever you're
  // currently showing" after a moderation action, since a coordinator could
  // be looking at any gender filter or year group when that happens.
  const [studentsRefreshKey, setStudentsRefreshKey] = useState(0);

  // Ban/remove modal — kept separate (like faculty rejection) so a reason can
  // be captured deliberately; { user, action: "ban" | "delete" } or null.
  const [moderating, setModerating] = useState(null);
  const [reason, setReason] = useState("");
  const [moderatingBusy, setModeratingBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth("/admin/analytics");
        if (res?.success) setAnalytics(res.analytics);
        else setError(res?.message || "Could not load analytics.");
      } catch {
        setError("Could not load analytics.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadFaculty = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/admin/faculty");
      if (res?.success) setFaculty(res.faculty);
    } catch {
      setFaculty([]);
    }
  }, []);

  // Lazy-load the faculty roster the first time that tab is opened (Students
  // no longer needs this — StudentsTab loads itself on mount).
  useEffect(() => {
    if (tab === "Faculty" && faculty === null) loadFaculty();
  }, [tab, faculty, loadFaculty]);

  // ── Account moderation: ban / unban / delete ──────────────────────
  // Patches the Faculty roster in place (small, unpaginated, matches
  // Approvals.jsx's removeFromList pattern); bumps the Students refresh key
  // instead, since that roster is paginated/filtered and may not have the
  // affected row loaded at all.

  const patchStatus = useCallback((id, accountStatus) => {
    setFaculty((prev) =>
      prev ? prev.map((f) => (f._id === id ? { ...f, accountStatus } : f)) : prev
    );
    setStudentsRefreshKey((k) => k + 1);
  }, []);

  const removeFromRosters = useCallback((id) => {
    setFaculty((prev) => (prev ? prev.filter((f) => f._id !== id) : prev));
    setStudentsRefreshKey((k) => k + 1);
  }, []);

  const openBan = (user) => {
    setModerating({ user, action: "ban" });
    setReason("");
  };

  const openDelete = (user) => {
    setModerating({ user, action: "delete" });
    setReason("");
  };

  const closeModerate = () => {
    setModerating(null);
    setReason("");
  };

  const handleUnban = async (user) => {
    const ok = await confirm({
      title: `Restore ${user.name}'s account?`,
      message: "They will be able to sign in again immediately.",
      confirmLabel: "Restore access",
    });
    if (!ok) return;

    try {
      const res = await patchWithAuth(`/admin/users/${user._id}/unban`);
      if (res.success) {
        patchStatus(user._id, "Active");
        toast.success(`${user.name}'s account was restored.`);
      } else {
        toast.error(res.message || "Could not restore this account.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    }
  };

  const handleModerateSubmit = async () => {
    const { user, action } = moderating;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      toast.error("Please give a short reason (at least 3 characters).");
      return;
    }

    setModeratingBusy(true);
    try {
      const res =
        action === "ban"
          ? await patchWithAuth(`/admin/users/${user._id}/ban`, {
              reason: trimmed,
            })
          : await deleteWithAuth(`/admin/users/${user._id}`, {
              reason: trimmed,
            });

      if (res.success) {
        if (action === "ban") {
          patchStatus(user._id, "Suspended");
          toast.success(`${user.name}'s account was suspended.`);
        } else {
          removeFromRosters(user._id);
          toast.success(`${user.name}'s account was removed.`);
        }
        closeModerate();
      } else {
        toast.error(
          res.message ||
            `Could not ${action === "ban" ? "suspend" : "remove"} this account.`
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setModeratingBusy(false);
    }
  };

  const shell = (inner) => (
    <>
      <Navbar />
      <div className="an">
        <PageHero
          title="Analytics"
          subtitle="An overview of activity across your institution."
          mark={false}
        />
        <div className="container an-body">
          <div className="an-tabs" role="tablist" aria-label="Analytics views">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`an-tab${tab === t ? " active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {inner}
        </div>
      </div>
      {viewUserId && (
        <ProfileModal
          userId={viewUserId}
          onClose={() => setViewUserId(null)}
        />
      )}
      {viewFacultyId && (
        <FacultyDetailModal
          facultyId={viewFacultyId}
          onClose={() => setViewFacultyId(null)}
        />
      )}
      {moderating && (
        <Modal
          open
          onClose={closeModerate}
          title={
            moderating.action === "ban"
              ? `Suspend ${moderating.user.name}?`
              : `Remove ${moderating.user.name}'s account?`
          }
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={closeModerate}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleModerateSubmit}
                disabled={moderatingBusy}
              >
                {moderatingBusy
                  ? "Working…"
                  : moderating.action === "ban"
                  ? "Suspend account"
                  : "Remove account"}
              </Button>
            </>
          }
        >
          <p className="approvals-modal-hint">
            {moderating.action === "ban"
              ? "They will not be able to sign in until you restore access. They'll be emailed and asked to get in touch with you in person."
              : "This permanently removes their account and everything tied to it — opportunities, applications, conversations and notifications. This cannot be undone."}
          </p>
          <Field id="moderate-reason" label="Reason (required)">
            <textarea
              placeholder={
                moderating.action === "ban"
                  ? "e.g. Reported for inappropriate messages to an applicant."
                  : "e.g. Requested account deletion in person."
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </Field>
        </Modal>
      )}
    </>
  );

  if (loading)
    return shell(
      <div className="an-state">
        <Spinner center label="Loading analytics" />
      </div>
    );
  if (error)
    return shell(
      <div className="an-state">
        <EmptyState
          icon={<IconAlert />}
          title="Couldn’t load analytics"
          description={error}
        />
      </div>
    );
  if (!analytics) return null;

  if (tab === "Opportunities")
    return shell(
      <OpportunitiesTab filter={oppFilter} onFilterChange={setOppFilter} />
    );
  if (tab === "Faculty")
    return shell(
      <FacultyTable
        rows={faculty}
        onView={setViewFacultyId}
        onBan={openBan}
        onUnban={handleUnban}
        onDelete={openDelete}
      />
    );
  if (tab === "Students") {
    return shell(
      <StudentsTab
        refreshKey={studentsRefreshKey}
        onView={setViewUserId}
        onBan={openBan}
        onUnban={handleUnban}
        onDelete={openDelete}
      />
    );
  }

  return shell(
    <Overview
      a={analytics}
      onSelectTab={setTab}
      navigate={navigate}
      onOpenOpportunities={openOpportunities}
      onViewProfile={setViewFacultyId}
    />
  );
}

// ── Needs attention ──────────────────────────────────────────────
// "Awaiting first review" is informational only — no cross-opportunity
// applications view exists yet to drill into (the Applications tab was tried
// and pulled pending a conversation with a faculty admin about whether it's
// actually wanted). The other three rows have real destinations.

function NeedsAttention({
  closingSoon,
  zeroApps,
  awaitingReview,
  pendingApprovals,
  onOpenApprovals,
  onOpenOpportunities,
}) {
  return (
    <section className="oq-card an-card an-attention">
      <h2 className="an-attention-title">Needs attention</h2>

      <button
        type="button"
        className="an-attention-row an-attention-row--clickable"
        onClick={() => onOpenOpportunities("Active", "deadline")}
      >
        <span className="an-attention-icon an-attention-icon--warn">
          <IconClock />
        </span>
        <span className="an-attention-text">
          <strong>{closingSoon}</strong>{" "}
          {closingSoon === 1 ? "opportunity is" : "opportunities are"} closing
          within {CLOSING_SOON_DAYS} days
        </span>
        <IconArrowRight className="an-attention-chevron" />
      </button>

      <button
        type="button"
        className="an-attention-row an-attention-row--clickable"
        onClick={() => onOpenOpportunities("Active", "applications")}
      >
        <span className="an-attention-icon an-attention-icon--warn">
          <IconAlert />
        </span>
        <span className="an-attention-text">
          <strong>{zeroApps}</strong>{" "}
          {zeroApps === 1 ? "opportunity has" : "opportunities have"} received
          zero applications
        </span>
        <IconArrowRight className="an-attention-chevron" />
      </button>

      <div className="an-attention-row">
        <span className="an-attention-icon an-attention-icon--pending">
          <IconClock />
        </span>
        <span className="an-attention-text">
          <strong>{awaitingReview}</strong>{" "}
          {awaitingReview === 1 ? "application is" : "applications are"}{" "}
          awaiting first review
        </span>
      </div>

      <button
        type="button"
        className="an-attention-row an-attention-row--clickable"
        onClick={onOpenApprovals}
      >
        <span className="an-attention-icon an-attention-icon--pending">
          <IconUser />
        </span>
        <span className="an-attention-text">
          <strong>{pendingApprovals}</strong> faculty{" "}
          {pendingApprovals === 1 ? "approval is" : "approvals are"} pending
          your review
        </span>
        <IconArrowRight className="an-attention-chevron" />
      </button>
    </section>
  );
}

// A step-through month picker: prev/next arrows around a label, rather than
// a flat list of 12 pills (clutter) or a native <select> (looks and behaves
// inconsistently across browsers, and doesn't make the "you're at the most
// recent available month" boundary visible). `options` is most-recent-first;
// the forward arrow disables exactly at options[0] — there's deliberately no
// way to step into a future month with no data yet, and the disabled state
// makes that boundary self-explanatory rather than a silent cutoff.
function MonthStepper({ ariaLabel, value, options, onChange }) {
  const index = options.indexOf(value);
  const atNewest = index <= 0;
  const atOldest = index === -1 || index >= options.length - 1;
  return (
    <div className="an-stepper" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="an-stepper-btn"
        aria-label="Earlier month"
        disabled={atOldest}
        onClick={() => onChange(options[index + 1])}
      >
        <IconArrowLeft />
      </button>
      <span className="an-stepper-label">{value}</span>
      <button
        type="button"
        className="an-stepper-btn"
        aria-label="Later month"
        disabled={atNewest}
        onClick={() => onChange(options[index - 1])}
      >
        <IconArrowRight />
      </button>
    </div>
  );
}

// ── Faculty engagement ───────────────────────────────────────────
// Replaces the old "Faculty by status" tiles: Pending already lives in Needs
// Attention, and Active/Rejected/Suspended counts alone didn't carry enough
// on their own to justify a card. A leaderboard of who's actually posting
// (and how many applications those postings draw) is the more useful
// institutional question. Deliberately framed as an internal count, not a
// named "best faculty" ranking.

// Exported for direct testing, same reasoning as Overview/OpportunitiesTab.
export function FacultyEngagement({ activeFacultyCount, onViewProfile }) {
  const [monthOptions] = useState(() => recentMonths(12));
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(monthOptions[0]);
  const [rangeFrom, setRangeFrom] = useState(monthOptions[Math.min(2, monthOptions.length - 1)]);
  const [rangeTo, setRangeTo] = useState(monthOptions[0]);
  const [topN, setTopN] = useState(5);
  const [sortBy, setSortBy] = useState("apps");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({ mode, topN: String(topN), sortBy });
      if (mode === "month") params.set("month", month);
      if (mode === "custom") {
        params.set("from", rangeFrom);
        params.set("to", rangeTo);
      }
      try {
        const res = await fetchWithAuth(`/admin/analytics/faculty-activity?${params.toString()}`);
        if (!cancelled) {
          setData(
            res?.success
              ? { faculty: res.faculty, participation: res.participation }
              : { faculty: [], participation: 0 }
          );
        }
      } catch {
        if (!cancelled) setData({ faculty: [], participation: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, month, rangeFrom, rangeTo, topN, sortBy]);

  const rangeLabel =
    mode === "month" ? month : mode === "ytd" ? "Year to Date" : `${rangeFrom} to ${rangeTo}`;
  const participationSuffix =
    mode === "ytd"
      ? "so far this year"
      : mode === "custom"
      ? `between ${rangeFrom} and ${rangeTo}`
      : `in ${month}`;

  return (
    <section className="oq-card an-card an-engagement-card">
      <div className="an-funnel-head">
        <h2>Faculty engagement</h2>
        <div className="an-chip-row" role="group" aria-label="Time range">
          {RANGE_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`an-chip${mode === m.value ? " active" : ""}`}
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "month" && (
        <div className="an-range-row">
          <MonthStepper ariaLabel="Month" value={month} options={monthOptions} onChange={setMonth} />
        </div>
      )}

      {mode === "custom" && (
        <div className="an-range-row">
          <span className="an-range-label">From</span>
          <MonthStepper
            ariaLabel="From month"
            value={rangeFrom}
            options={monthOptions}
            onChange={setRangeFrom}
          />
          <span className="an-range-label">to</span>
          <MonthStepper ariaLabel="To month" value={rangeTo} options={monthOptions} onChange={setRangeTo} />
        </div>
      )}

      {data === null ? (
        <Spinner center label="Loading" />
      ) : (
        <>
          <p className="an-eng-hint">
            {data.participation} of {activeFacultyCount} active faculty posted {participationSuffix}
          </p>

          <div className="an-eng-head">
            <span className="an-eng-head-label">Leaderboard · {rangeLabel}</span>
            <div className="an-opp-controls-right">
              <div className="an-chip-row" role="group" aria-label="Rank by">
                <button
                  type="button"
                  className={`an-chip${sortBy === "apps" ? " active" : ""}`}
                  aria-pressed={sortBy === "apps"}
                  onClick={() => setSortBy("apps")}
                >
                  Applications
                </button>
                <button
                  type="button"
                  className={`an-chip${sortBy === "postings" ? " active" : ""}`}
                  aria-pressed={sortBy === "postings"}
                  onClick={() => setSortBy("postings")}
                >
                  Postings
                </button>
              </div>
              <div className="an-chip-row" role="group" aria-label="Show top">
                {TOP_N_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`an-chip${topN === n ? " active" : ""}`}
                    aria-pressed={topN === n}
                    onClick={() => setTopN(n)}
                  >
                    Top {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {data.faculty.length === 0 ? (
            <p className="an-empty">No faculty activity in this range.</p>
          ) : (
            <ol className="an-eng-list">
              {data.faculty.map((f, i) => (
                <li key={f.facultyId}>
                  <button
                    type="button"
                    className="an-eng-row"
                    onClick={() => onViewProfile(f.facultyId)}
                  >
                    <span className="an-top-rank">{i + 1}</span>
                    <span className="an-eng-person">
                      <span className="an-eng-name">{f.name}</span>
                      <span className="an-eng-meta">{f.department || "-"}</span>
                    </span>
                    <span className="an-eng-stats">
                      <span className="an-eng-stat">
                        <span className="an-eng-stat-value">{f.postings}</span>
                        <span className="an-eng-stat-label">
                          {f.postings === 1 ? "posting" : "postings"}
                        </span>
                      </span>
                      <span className="an-eng-stat">
                        <span className="an-eng-stat-value">{f.apps}</span>
                        <span className="an-eng-stat-label">
                          {f.apps === 1 ? "application" : "applications"}
                        </span>
                      </span>
                    </span>
                    <IconArrowRight className="an-top-chevron" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

// ── Overview ──────────────────────────────────────────────────────

// Exported (in addition to the page's default export) so Overview's
// data-derived rendering — KPI math, needs-attention counts, funnel category
// filtering — can be tested directly, without standing up the whole page's
// router/providers/navbar. See Analytics.test.jsx.
export function Overview({ a, onSelectTab, navigate, onOpenOpportunities, onViewProfile }) {
  const {
    kpis,
    applicationFunnel,
    awaitingFirstReview,
    opportunitiesByStatus = {},
    topOpportunities,
    applicationsTrend,
  } = a;

  const [category, setCategory] = useState("All");
  const [funnel, setFunnel] = useState(applicationFunnel);
  const [demand, setDemand] = useState(null);
  const [activeOpps, setActiveOpps] = useState(null);

  // Category-demand and the active-opportunities snapshot (behind the Needs
  // Attention counts) are Overview-only data, loaded once.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth("/admin/analytics/category-demand");
        if (res?.success) setDemand(res.demand);
      } catch {
        /* the panel below renders its own loading/empty state */
      }
    })();
    (async () => {
      try {
        const res = await fetchWithAuth("/admin/opportunities?status=Active");
        if (res?.success) setActiveOpps(res.opportunities);
        else setActiveOpps([]);
      } catch {
        setActiveOpps([]);
      }
    })();
  }, []);

  // Re-fetch the funnel when the category filter changes. "All" reuses the
  // figures already in the bundled analytics payload instead of a redundant
  // request for the common case.
  useEffect(() => {
    if (category === "All") {
      setFunnel(applicationFunnel);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth(
          `/admin/analytics/funnel?category=${encodeURIComponent(category)}`
        );
        if (!cancelled && res?.success) setFunnel(res.funnel);
      } catch {
        /* keep showing the previous category's funnel on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
    // applicationFunnel is a new object on every parent render; re-running
    // this effect only on `category` is deliberate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const closingSoonCount =
    activeOpps?.filter((o) => {
      const d = daysUntil(o.deadline);
      return d >= 0 && d <= CLOSING_SOON_DAYS;
    }).length ?? 0;
  const zeroAppsCount =
    activeOpps?.filter((o) => o.applicationsCount === 0).length ?? 0;

  const decided = (applicationFunnel.Selected || 0) + (applicationFunnel.Rejected || 0);
  const selectionRate = decided > 0 ? Math.round((applicationFunnel.Selected / decided) * 100) : 0;
  const appsPerActiveOpp =
    kpis.activeOpportunities > 0
      ? (kpis.totalApplications / kpis.activeOpportunities).toFixed(1)
      : "0.0";

  const kpiCards = [
    {
      label: "Students",
      value: kpis.students,
      iconTone: "students",
      icon: <IconUser />,
      onClick: () => onSelectTab("Students"),
    },
    {
      label: "Active Faculty",
      value: kpis.activeFaculty,
      iconTone: "faculty",
      icon: <IconUser />,
      onClick: () => onSelectTab("Faculty"),
    },
    {
      label: "Active Opportunities",
      value: kpis.activeOpportunities,
      iconTone: "opps",
      icon: <IconFile />,
      onClick: () => onOpenOpportunities("Active", "default"),
    },
    {
      label: "Total Applications",
      value: kpis.totalApplications,
      iconTone: "apps",
      icon: <IconInbox />,
    },
    {
      label: "Apps / Active Opportunity",
      value: appsPerActiveOpp,
      iconTone: "opps",
      icon: <IconFile />,
    },
    {
      label: "Selection Rate",
      value: `${selectionRate}%`,
      iconTone: "approvals",
      icon: <IconCheck />,
      tone: selectionRate > 0 ? "active" : undefined,
    },
  ];

  const funnelMax = Math.max(1, ...FUNNEL_STAGES.map((s) => funnel[s] || 0));
  // Stage-to-stage conversion — of the applicants who reached `from`, the
  // share that went on to `to`. Distinct from the bar width above (share of
  // everyone who applied), and the more actionable of the two numbers.
  const stageConversion = (from, to) =>
    funnel[from] > 0 ? Math.round(((funnel[to] || 0) / funnel[from]) * 100) : 0;

  const demandMax = demand ? Math.max(1, ...demand.map((d) => d.applications)) : 1;
  const topMax = Math.max(1, ...topOpportunities.map((o) => o.applications));

  return (
    <>
      <NeedsAttention
        closingSoon={closingSoonCount}
        zeroApps={zeroAppsCount}
        awaitingReview={awaitingFirstReview || 0}
        pendingApprovals={kpis.pendingFaculty}
        onOpenApprovals={() => navigate("/approvals")}
        onOpenOpportunities={onOpenOpportunities}
      />

      <div className="an-kpis">
        {kpiCards.map((k) => (
          <StatCard
            key={k.label}
            value={k.value}
            label={k.label}
            tone={k.tone}
            icon={k.icon}
            iconTone={k.iconTone}
            onClick={k.onClick}
          />
        ))}
      </div>

      <div className="an-grid-2">
        <section className="oq-card an-card">
          <div className="an-funnel-head">
            <h2>Application funnel</h2>
            <div className="an-chip-row" role="group" aria-label="Filter funnel by category">
              {["All", ...CATEGORY_ORDER].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`an-chip${category === c ? " active" : ""}`}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {FUNNEL_STAGES.map((s, i) => (
            <div key={s}>
              <BarRow label={s} value={funnel[s] || 0} max={funnelMax} tone={toneOf(s)} />
              {i < FUNNEL_STAGES.length - 1 && (funnel[s] || 0) > 0 && (
                <p className="an-conv">
                  ↓ {stageConversion(s, FUNNEL_STAGES[i + 1])}% of {s.toLowerCase()} went on to{" "}
                  {FUNNEL_STAGES[i + 1].toLowerCase()}
                </p>
              )}
            </div>
          ))}

          <div className="an-funnel-outcomes">
            <div className="an-outcome an-outcome--rejected">
              <span className="an-outcome-value">{funnel.Rejected || 0}</span>
              <span className="an-outcome-label">Rejected</span>
            </div>
            <div className="an-outcome an-outcome--withdrawn">
              <span className="an-outcome-value">{funnel.Withdrawn || 0}</span>
              <span className="an-outcome-label">Withdrawn</span>
            </div>
          </div>
        </section>

        <section className="oq-card an-card">
          <h2>Applications per opportunity</h2>
          {demand === null ? (
            <Spinner center label="Loading" />
          ) : (
            demand.map((d) => (
              <BarRow
                key={d.category}
                label={d.category}
                value={d.applications}
                max={demandMax}
                tone={toneOf(d.category)}
                caption={`${d.postings} posting${d.postings === 1 ? "" : "s"}`}
              />
            ))
          )}
        </section>
      </div>

      <div className="an-grid-2">
        <section className="oq-card an-card">
          <h2>Opportunity status</h2>
          <p className="an-card-hint">Tap a tile to see that list</p>
          <div className="an-stat-row">
            {OPPORTUNITY_STATUS_ORDER.map((s) => (
              <button
                type="button"
                className={`an-stat ${toneOf(s)}`}
                key={s}
                onClick={() => onOpenOpportunities(s, "default")}
              >
                <span className="an-stat-value">
                  {opportunitiesByStatus[s] || 0}
                </span>
                <span className="an-stat-label">{s}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="oq-card an-card">
          <h2>Top opportunities</h2>
          {topOpportunities.length === 0 ? (
            <p className="an-empty">No applications yet.</p>
          ) : (
            <ol className="an-top-list">
              {topOpportunities.map((o, i) => (
                <li key={o.opportunityId}>
                  <button
                    type="button"
                    className="an-top-row"
                    onClick={() => navigate(`/opportunity/${o.opportunityId}`)}
                  >
                    <span className="an-top-rank">{i + 1}</span>
                    <span className="an-top-body">
                      <span className="an-top-head">
                        <span className="an-top-title">{o.title}</span>
                        {o.category && <Tag category={o.category} />}
                      </span>
                      <span className="an-top-track">
                        <span
                          className="an-top-fill"
                          style={{ width: `${Math.max(6, Math.round((o.applications / topMax) * 100))}%` }}
                        />
                      </span>
                    </span>
                    <span className="an-top-count">{o.applications}</span>
                    <IconArrowRight className="an-top-chevron" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <FacultyEngagement activeFacultyCount={kpis.activeFaculty} onViewProfile={onViewProfile} />

      <ActivityTrend initialTrend={applicationsTrend} />
    </>
  );
}

// ── Activity trend ────────────────────────────────────────────────
// A period (7d/30d/90d) × series (Applications/Signups/Postings) toggle over
// one day-bucketed bar chart. 30d/Applications is the default and is free —
// it reuses the trend already bundled in the main analytics payload, the same
// "All reuses the bundled figures" shortcut the funnel's category filter
// above takes; any other combination fetches /admin/analytics/trend.

// Exported for direct testing, same reasoning as Overview's other sub-parts.
export function ActivityTrend({ initialTrend }) {
  const [period, setPeriod] = useState("30d");
  const [series, setSeries] = useState("applications");
  const [trend, setTrend] = useState(initialTrend);
  const isDefault = period === "30d" && series === "applications";

  useEffect(() => {
    if (isDefault) {
      setTrend(initialTrend);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth(
          `/admin/analytics/trend?period=${period}&series=${series}`
        );
        if (!cancelled) setTrend(res?.success ? res.trend : []);
      } catch {
        if (!cancelled) setTrend([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // initialTrend is a new array identity on every parent render (fetched
    // once, on mount); re-running only on the toggle itself is deliberate —
    // same reasoning as the funnel's category effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, series]);

  const seriesLabel = TREND_SERIES.find((s) => s.value === series).label;
  const periodLabel = TREND_PERIODS.find((p) => p.value === period).label;
  // All three series labels pluralize regularly (application/s, signup/s,
  // posting/s), so the singular noun is just the label minus its trailing "s".
  const unitSingular = seriesLabel.slice(0, -1).toLowerCase();
  const pluralUnit = (n) => `${n} ${unitSingular}${n === 1 ? "" : "s"}`;
  const trendMax = Math.max(1, ...trend.map((d) => d.count));
  const trendTotal = trend.reduce((s, d) => s + d.count, 0);
  const tickCount = Math.min(4, trend.length);
  const tickIndexes = [
    ...new Set(
      Array.from({ length: tickCount }, (_, i) =>
        Math.round((i * (trend.length - 1)) / Math.max(1, tickCount - 1))
      )
    ),
  ];
  const ticks = tickIndexes.map((i) => trend[i]?.date.slice(5)).filter(Boolean);

  return (
    <section className="oq-card an-card an-trend-card">
      <div className="an-trend-head">
        <h2>
          {seriesLabel} in the last {periodLabel}
        </h2>
        <div className="an-chip-row" role="group" aria-label="Series">
          {TREND_SERIES.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`an-chip${series === s.value ? " active" : ""}`}
              aria-pressed={series === s.value}
              onClick={() => setSeries(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="an-trend-controls">
        <div className="an-chip-row" role="group" aria-label="Period">
          {TREND_PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`an-chip${period === p.value ? " active" : ""}`}
              aria-pressed={period === p.value}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {trendTotal > 0 && <span className="an-trend-total">{trendTotal} total</span>}
      </div>
      {trendTotal > 0 ? (
        <>
          <div className="an-trend">
            {trend.map((d) => {
              const label = trendDate(d.date);
              return (
                <div
                  key={d.date}
                  className="an-trend-col"
                  aria-label={`${label}: ${pluralUnit(d.count)}`}
                >
                  <span
                    className="an-trend-bar"
                    style={{ height: `${Math.round((d.count / trendMax) * 100)}%` }}
                  />
                  <span className="an-trend-tip" aria-hidden="true">
                    <strong>{label}</strong> · {pluralUnit(d.count)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="an-trend-axis">
            {ticks.map((t, i) => (
              <span key={`${t}-${i}`}>{t}</span>
            ))}
          </div>
        </>
      ) : (
        <p className="an-empty">No {seriesLabel.toLowerCase()} yet.</p>
      )}
    </section>
  );
}

// ── Opportunities ─────────────────────────────────────────────────

// Exported for the same reason as Overview — direct testing without the
// page's router/providers.
export function OpportunitiesTab({ filter, onFilterChange }) {
  // "Loading" is derived by comparing the filter this result was fetched for
  // against the current filter, rather than clearing state synchronously
  // inside the effect (setState-in-effect forces an extra render and is a
  // React anti-pattern) — while they differ, a fetch for the current filter
  // is in flight or about to start.
  const [result, setResult] = useState({ key: null, rows: [] });
  const [view, setView] = useState("list");

  const key = `${filter.status}|${filter.sort}`;
  const loading = result.key !== key;
  const rows = loading ? null : result.rows;

  useEffect(() => {
    const requestKey = `${filter.status}|${filter.sort}`;
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams();
      if (filter.status !== "All") params.set("status", filter.status);
      if (filter.sort !== "default") params.set("sort", filter.sort);
      const qs = params.toString();
      try {
        const res = await fetchWithAuth(
          `/admin/opportunities${qs ? `?${qs}` : ""}`
        );
        if (!cancelled) {
          setResult({ key: requestKey, rows: res?.success ? res.opportunities : [] });
        }
      } catch {
        if (!cancelled) setResult({ key: requestKey, rows: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter.status, filter.sort]);

  const grouped =
    view === "grouped" && rows
      ? CATEGORY_ORDER.map((cat) => ({
          category: cat,
          rows: rows.filter((o) => o.category === cat),
        })).filter((g) => g.rows.length > 0)
      : null;

  return (
    <>
      <div className="an-opp-controls">
        <div className="an-chip-row" role="group" aria-label="Filter by status">
          {["All", ...OPPORTUNITY_STATUS_ORDER].map((s) => (
            <button
              key={s}
              type="button"
              className={`an-chip${filter.status === s ? " active" : ""}`}
              aria-pressed={filter.status === s}
              onClick={() => onFilterChange({ status: s, sort: filter.sort })}
            >
              {s}
            </button>
          ))}
          {(filter.status !== "All" || filter.sort !== "default") && (
            <button
              type="button"
              className="an-clear-filters"
              onClick={() => onFilterChange({ status: "All", sort: "default" })}
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="an-opp-controls-right">
          <div className="an-chip-row" role="group" aria-label="Sort">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`an-chip${filter.sort === opt.value ? " active" : ""}`}
                aria-pressed={filter.sort === opt.value}
                onClick={() => onFilterChange({ status: filter.status, sort: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="an-chip-row" role="group" aria-label="View">
            <button
              type="button"
              className={`an-chip${view === "list" ? " active" : ""}`}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              List
            </button>
            <button
              type="button"
              className={`an-chip${view === "grouped" ? " active" : ""}`}
              aria-pressed={view === "grouped"}
              onClick={() => setView("grouped")}
            >
              By category
            </button>
          </div>
        </div>
      </div>

      {rows === null ? (
        <div className="an-state">
          <Spinner center label="Loading opportunities" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No opportunities${filter.status !== "All" ? ` in ${filter.status}` : ""}`}
          description="Postings will appear here as faculty create them."
        />
      ) : view === "list" ? (
        <OpportunitiesTable rows={rows} />
      ) : (
        grouped.map((g) => (
          <section key={g.category} className="oq-card an-card an-table-card an-opp-group">
            <div className="an-opp-group-head">
              <Tag category={g.category} />
              <span className="an-table-count">
                {g.rows.length} {g.rows.length === 1 ? "opportunity" : "opportunities"}
              </span>
            </div>
            <OpportunitiesTable rows={g.rows} hideCategory />
          </section>
        ))
      )}
    </>
  );
}

function OpportunitiesTable({ rows, hideCategory }) {
  return (
    <section className="oq-card an-card an-table-card">
      <div className="table-wrap">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Title</th>
              {!hideCategory && <th>Category</th>}
              <th>Status</th>
              <th>Posted by</th>
              <th>Deadline</th>
              <th>Applications</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o._id}>
                <td>{o.title}</td>
                {!hideCategory && (
                  <td>
                    <Tag category={o.category} />
                  </td>
                )}
                <td>
                  <Tag status={o.status} />
                </td>
                <td>{o.postedBy || "-"}</td>
                <td>
                  <UrgencyChip deadline={o.deadline} />
                </td>
                <td
                  className={
                    o.applicationsCount === 0 && o.status === "Active"
                      ? "an-opp-zero"
                      : undefined
                  }
                >
                  {o.applicationsCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Faculty detail modal ─────────────────────────────────────────
// A faculty-specific detail card (opportunities posted, applications
// received, employee ID, office) — distinct from the generic ProfileModal
// (bio/skills) used for students, since a coordinator clicking a faculty
// name from the roster or the engagement leaderboard is after their
// institutional record, not a public bio. Always all-time figures, regardless
// of whatever range was selected on the leaderboard when it was clicked —
// see the backend comment on facultyPostingStats for why.

// Exported for direct testing, same reasoning as the page's other sub-components.
export function FacultyDetailModal({ facultyId, onClose }) {
  const [faculty, setFaculty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchWithAuth(`/admin/faculty/${facultyId}`);
        if (!active) return;
        if (res?.success) {
          setFaculty(res.faculty);
        } else {
          // faculty stays null — the modal shows its own unavailable state —
          // but log why, the same way ProfileModal does, so a real failure
          // (404, validation error, stale deploy missing this route) is
          // diagnosable from the console instead of just "unavailable".
          console.error("Could not load faculty detail:", res);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [facultyId]);

  return (
    <Modal open onClose={onClose} title={faculty?.name || "Faculty"} size="sm">
      {loading ? (
        <Spinner center label="Loading" />
      ) : !faculty ? (
        <p className="an-empty">Profile unavailable.</p>
      ) : (
        <div className="an-fac-detail">
          <div className="an-fac-detail-head">
            <Avatar name={faculty.name} image={faculty.profileImage} size={48} />
            <div>
              <div className="an-fac-detail-dept">{faculty.department || "-"}</div>
              <Tag status={faculty.accountStatus} />
            </div>
          </div>
          <div className="an-fac-detail-stats">
            <div className="an-fac-detail-row">
              <span>Opportunities posted</span>
              <span className="an-fac-detail-value">{faculty.opportunitiesPosted}</span>
            </div>
            <div className="an-fac-detail-row">
              <span>Applications received</span>
              <span className="an-fac-detail-value">{faculty.applicationsReceived}</span>
            </div>
            <div className="an-fac-detail-row">
              <span>Employee ID</span>
              <span className="an-fac-detail-value">{faculty.employeeId || "-"}</span>
            </div>
            <div className="an-fac-detail-row">
              <span>Office</span>
              <span className="an-fac-detail-value">{faculty.office || "-"}</span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Faculty roster ────────────────────────────────────────────────

// Row-level ban/unban/delete controls, shared by both rosters. Stops
// propagation on every button so acting on a row never also triggers the
// row's own onClick (open profile).
function ModerationActions({ person, onBan, onUnban, onDelete }) {
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn(person);
  };
  return (
    <div className="an-row-actions">
      {person.accountStatus === "Suspended" ? (
        <Button variant="outline" size="sm" onClick={stop(onUnban)}>
          Restore
        </Button>
      ) : (
        person.accountStatus === "Active" && (
          <Button variant="outline" size="sm" onClick={stop(onBan)}>
            Suspend
          </Button>
        )
      )}
      <button
        type="button"
        className="an-row-delete"
        aria-label={`Remove ${person.name}'s account`}
        onClick={stop(onDelete)}
      >
        <IconTrash />
      </button>
    </div>
  );
}

const NO_DEPARTMENT = "No department listed";

// Exported for direct testing, same reasoning as Overview/OpportunitiesTab.
export function FacultyTable({ rows, onView, onBan, onUnban, onDelete }) {
  const [view, setView] = useState("list");

  if (rows === null)
    return (
      <div className="an-state">
        <Spinner center label="Loading faculty" />
      </div>
    );
  if (rows.length === 0)
    return (
      <section className="oq-card an-card">
        <p className="an-empty">No faculty in your institution yet.</p>
      </section>
    );

  // Grouped client-side — the whole roster is already loaded unpaginated, so
  // no second request is needed to reorganize it. Department is free text
  // (no controlled vocabulary), so this groups on whatever string a faculty
  // member's profile actually has; near-duplicate spellings ("CSE" vs
  // "Computer Science") show as separate groups until that's normalized.
  const grouped =
    view === "grouped"
      ? Object.entries(
          rows.reduce((acc, f) => {
            const dept = f.department || NO_DEPARTMENT;
            (acc[dept] ||= []).push(f);
            return acc;
          }, {})
        ).sort(([a], [b]) => a.localeCompare(b))
      : null;

  const tableProps = { onView, onBan, onUnban, onDelete };

  return (
    <>
      <div className="an-opp-controls an-opp-controls--end">
        <div className="an-chip-row" role="group" aria-label="View">
          <button
            type="button"
            className={`an-chip${view === "list" ? " active" : ""}`}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            type="button"
            className={`an-chip${view === "grouped" ? " active" : ""}`}
            aria-pressed={view === "grouped"}
            onClick={() => setView("grouped")}
          >
            By department
          </button>
        </div>
      </div>

      {view === "list" ? (
        <FacultyRosterTable rows={rows} {...tableProps} />
      ) : (
        grouped.map(([dept, deptRows]) => (
          <section key={dept} className="oq-card an-card an-table-card an-opp-group">
            <div className="an-opp-group-head">
              <span className="an-dept-chip">{dept}</span>
              <span className="an-table-count">
                {deptRows.length} {deptRows.length === 1 ? "faculty member" : "faculty members"}
              </span>
            </div>
            <FacultyRosterTable rows={deptRows} {...tableProps} hideDepartment />
          </section>
        ))
      )}
    </>
  );
}

function FacultyRosterTable({ rows, onView, onBan, onUnban, onDelete, hideDepartment }) {
  return (
    <section className="oq-card an-card an-table-card">
      <div className="table-wrap">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Faculty</th>
              {!hideDepartment && <th>Department</th>}
              <th>Employee ID</th>
              <th>Status</th>
              <th>Posted</th>
              <th>Registered</th>
              <th>Approved</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr
                key={f._id}
                className="an-row-clickable"
                tabIndex={0}
                aria-label={`View ${f.name}'s profile`}
                onClick={() => onView(f._id)}
                onKeyDown={(e) => e.key === "Enter" && onView(f._id)}
              >
                <td>
                  <div className="an-person">
                    <Avatar name={f.name} image={f.profileImage} size={30} />
                    <span>{f.name}</span>
                  </div>
                </td>
                {!hideDepartment && <td>{f.department || "-"}</td>}
                <td>{f.employeeId || "-"}</td>
                <td>
                  <Tag status={f.accountStatus} />
                </td>
                <td className="an-eng-apps">{f.opportunitiesPosted ?? 0}</td>
                <td>{fmtDate(f.createdAt)}</td>
                <td>{fmtDate(f.approvedAt)}</td>
                <td>
                  <ModerationActions
                    person={f}
                    onBan={onBan}
                    onUnban={onUnban}
                    onDelete={onDelete}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Students ──────────────────────────────────────────────────────

const GENDER_ORDER = ["All", "Male", "Female", "Other"];
const STUDENT_YEARS = [1, 2, 3, 4];

// "(female)", "(female, CSE)", "" — the active gender/branch filter, worded
// for an empty-state sentence.
const describeStudentFilter = (gender, branch) => {
  const parts = [];
  if (gender !== "All") parts.push(gender.toLowerCase());
  if (branch !== "All") parts.push(branch);
  return parts.length ? ` (${parts.join(", ")})` : "";
};

// Exported for direct testing, same reasoning as Overview/OpportunitiesTab.
export function StudentsTab({ onView, onBan, onUnban, onDelete, refreshKey }) {
  const [gender, setGender] = useState("All");
  const [branch, setBranch] = useState("All");
  const [view, setView] = useState("list");
  const [branches, setBranches] = useState([]);

  // Branch has no fixed vocabulary (free text on the student profile) — the
  // filter is built from whatever values are actually in use, not a guessed
  // list. Fetched once; a session-scale roster change (a student's branch
  // never changes via ban/unban/delete) doesn't need this to track refreshKey.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth("/admin/students/branches");
        if (!cancelled && res?.success) setBranches(res.branches);
      } catch {
        /* the branch filter just won't offer extra options */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="an-opp-controls">
        <div className="an-chip-row" role="group" aria-label="Filter by gender">
          {GENDER_ORDER.map((g) => (
            <button
              key={g}
              type="button"
              className={`an-chip${gender === g ? " active" : ""}`}
              aria-pressed={gender === g}
              onClick={() => setGender(g)}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="an-chip-row" role="group" aria-label="View">
          <button
            type="button"
            className={`an-chip${view === "list" ? " active" : ""}`}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            type="button"
            className={`an-chip${view === "grouped" ? " active" : ""}`}
            aria-pressed={view === "grouped"}
            onClick={() => setView("grouped")}
          >
            By year
          </button>
        </div>
      </div>

      {branches.length > 0 && (
        <div
          className="an-chip-row an-chip-row--wrap an-branch-row"
          role="group"
          aria-label="Filter by branch"
        >
          {["All", ...branches].map((b) => (
            <button
              key={b}
              type="button"
              className={`an-chip${branch === b ? " active" : ""}`}
              aria-pressed={branch === b}
              onClick={() => setBranch(b)}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      <StudentEngagementPanel gender={gender} refreshKey={refreshKey} />

      {view === "list" ? (
        <StudentsRosterList
          gender={gender}
          branch={branch}
          refreshKey={refreshKey}
          onView={onView}
          onBan={onBan}
          onUnban={onUnban}
          onDelete={onDelete}
        />
      ) : (
        <StudentsByYear
          // Remounts fresh whenever the scope changes, so a year's already-
          // expanded/loaded roster from a previous filter can never leak
          // into the new one — simpler and more correct than manually
          // resetting local state in an effect.
          key={`${gender}|${branch}|${refreshKey}`}
          gender={gender}
          branch={branch}
          refreshKey={refreshKey}
          onView={onView}
          onBan={onBan}
          onUnban={onUnban}
          onDelete={onDelete}
        />
      )}
    </>
  );
}

// Applications by year and by category, scoped to the tab's gender filter —
// distinct from the roster below (that's student counts; this is application
// counts from students of each year/category).
function StudentEngagementPanel({ gender, refreshKey }) {
  const [result, setResult] = useState({ key: null, byYear: {}, byCategory: {} });
  const key = `${gender}|${refreshKey}`;
  const loading = result.key !== key;

  useEffect(() => {
    const requestKey = `${gender}|${refreshKey}`;
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams();
      if (gender !== "All") params.set("gender", gender);
      const qs = params.toString();
      try {
        const res = await fetchWithAuth(
          `/admin/analytics/student-engagement${qs ? `?${qs}` : ""}`
        );
        if (!cancelled) {
          setResult(
            res?.success
              ? { key: requestKey, byYear: res.engagement.byYear, byCategory: res.engagement.byCategory }
              : { key: requestKey, byYear: {}, byCategory: {} }
          );
        }
      } catch {
        if (!cancelled) setResult({ key: requestKey, byYear: {}, byCategory: {} });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gender, refreshKey]);

  if (loading) {
    return (
      <section className="oq-card an-card an-engagement-card">
        <Spinner center label="Loading" />
      </section>
    );
  }

  const yearMax = Math.max(1, ...STUDENT_YEARS.map((y) => result.byYear[y] || 0));
  const catMax = Math.max(1, ...CATEGORY_ORDER.map((c) => result.byCategory[c] || 0));
  const total = STUDENT_YEARS.reduce((s, y) => s + (result.byYear[y] || 0), 0);

  return (
    <section className="oq-card an-card an-engagement-card">
      <h2>Student engagement</h2>
      <p className="an-card-hint">
        {total} application{total === 1 ? "" : "s"}
        {gender === "All" ? " institute-wide" : ` from ${gender.toLowerCase()} students`}
      </p>
      <div className="an-eng-cols">
        <div>
          <div className="an-eng-head-label an-eng-col-title">Applications by year</div>
          {STUDENT_YEARS.map((y) => (
            <BarRow
              key={y}
              label={`Year ${y}`}
              value={result.byYear[y] || 0}
              max={yearMax}
              tone="applied"
            />
          ))}
        </div>
        <div>
          <div className="an-eng-head-label an-eng-col-title">Applications by category</div>
          {CATEGORY_ORDER.map((c) => (
            <BarRow
              key={c}
              label={c}
              value={result.byCategory[c] || 0}
              max={catMax}
              tone={toneOf(c)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function StudentsRosterList({ gender, branch, refreshKey, onView, onBan, onUnban, onDelete }) {
  const [result, setResult] = useState({ key: null, list: [], total: 0, hasMore: false });
  const key = `${gender}|${branch}|${refreshKey}`;
  const loading = result.key !== key;
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const requestKey = `${gender}|${branch}|${refreshKey}`;
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({ page: "1", limit: "20" });
      if (gender !== "All") params.set("gender", gender);
      if (branch !== "All") params.set("branch", branch);
      try {
        const res = await fetchWithAuth(`/admin/students?${params.toString()}`);
        if (!cancelled) {
          setResult(
            res?.success
              ? { key: requestKey, list: res.students, total: res.total, hasMore: res.hasMore }
              : { key: requestKey, list: [], total: 0, hasMore: false }
          );
        }
      } catch {
        if (!cancelled) setResult({ key: requestKey, list: [], total: 0, hasMore: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gender, branch, refreshKey]);

  // Triggered from a button click, never from the effect above — free to
  // setState synchronously here.
  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = Math.floor(result.list.length / 20) + 1;
      const params = new URLSearchParams({ page: String(nextPage), limit: "20" });
      if (gender !== "All") params.set("gender", gender);
      if (branch !== "All") params.set("branch", branch);
      const res = await fetchWithAuth(`/admin/students?${params.toString()}`);
      if (res?.success) {
        setResult((prev) => ({
          ...prev,
          list: [...prev.list, ...res.students],
          total: res.total,
          hasMore: res.hasMore,
        }));
      }
    } catch {
      /* keep the current list on failure */
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading)
    return (
      <div className="an-state">
        <Spinner center label="Loading students" />
      </div>
    );
  if (result.list.length === 0)
    return (
      <section className="oq-card an-card">
        <p className="an-empty">
          No students{describeStudentFilter(gender, branch)} registered yet.
        </p>
      </section>
    );

  return (
    <section className="oq-card an-card an-table-card">
      <div className="an-table-count">{result.total} students</div>
      <div className="table-wrap">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Student</th>
              <th>Branch</th>
              <th>Year</th>
              <th>Email</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.list.map((s) => (
              <tr
                key={s._id}
                className="an-row-clickable"
                tabIndex={0}
                aria-label={`View ${s.name}'s profile`}
                onClick={() => onView(s._id)}
                onKeyDown={(e) => e.key === "Enter" && onView(s._id)}
              >
                <td>
                  <div className="an-person">
                    <Avatar name={s.name} image={s.profileImage} size={30} />
                    <span>{s.name}</span>
                  </div>
                </td>
                <td>{s.branch || "-"}</td>
                <td>{s.year || "-"}</td>
                <td className="an-email">{s.email}</td>
                <td>{fmtDate(s.createdAt)}</td>
                <td>
                  <ModerationActions person={s} onBan={onBan} onUnban={onUnban} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.hasMore && (
        <div className="an-more">
          <Button type="button" variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </section>
  );
}

// One collapsible section per year. Group headers (counts) load eagerly and
// cheaply from year-counts; a group's actual roster only loads once expanded,
// each with its own "Load more" — the roster never has to be fetched in full
// just to show grouping.
function StudentsByYear({ gender, branch, refreshKey, onView, onBan, onUnban, onDelete }) {
  const [counts, setCounts] = useState({ key: null, byYear: {} });
  const countsKey = `${gender}|${branch}|${refreshKey}`;
  const countsLoading = counts.key !== countsKey;

  useEffect(() => {
    const requestKey = `${gender}|${branch}|${refreshKey}`;
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams();
      if (gender !== "All") params.set("gender", gender);
      if (branch !== "All") params.set("branch", branch);
      const qs = params.toString();
      try {
        const res = await fetchWithAuth(`/admin/students/year-counts${qs ? `?${qs}` : ""}`);
        if (!cancelled) setCounts({ key: requestKey, byYear: res?.success ? res.counts : {} });
      } catch {
        if (!cancelled) setCounts({ key: requestKey, byYear: {} });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gender, branch, refreshKey]);

  const [expanded, setExpanded] = useState({});
  const [groups, setGroups] = useState({});

  const loadYear = async (year, append) => {
    setGroups((prev) => ({
      ...prev,
      [year]: { ...(prev[year] || { list: [], total: 0, hasMore: false }), loading: true },
    }));
    const page = append ? Math.floor((groups[year]?.list.length || 0) / 20) + 1 : 1;
    const params = new URLSearchParams({ page: String(page), limit: "20", year: String(year) });
    if (gender !== "All") params.set("gender", gender);
    if (branch !== "All") params.set("branch", branch);
    try {
      const res = await fetchWithAuth(`/admin/students?${params.toString()}`);
      setGroups((prev) => ({
        ...prev,
        [year]: {
          list: append ? [...(prev[year]?.list || []), ...(res.students || [])] : res.students || [],
          total: res.total || 0,
          hasMore: !!res.hasMore,
          loading: false,
        },
      }));
    } catch {
      setGroups((prev) => ({
        ...prev,
        [year]: { ...(prev[year] || { list: [], total: 0, hasMore: false }), loading: false },
      }));
    }
  };

  const toggleYear = (year) => {
    const willExpand = !expanded[year];
    setExpanded((prev) => ({ ...prev, [year]: willExpand }));
    if (willExpand && !groups[year]) loadYear(year, false);
  };

  if (countsLoading)
    return (
      <div className="an-state">
        <Spinner center label="Loading" />
      </div>
    );

  return (
    <>
      {STUDENT_YEARS.map((year) => {
        const count = counts.byYear[year] || 0;
        const group = groups[year];
        const isOpen = !!expanded[year];
        return (
          <section key={year} className="oq-card an-card an-table-card an-opp-group">
            <button
              type="button"
              className="an-opp-group-head an-opp-group-head--toggle"
              onClick={() => toggleYear(year)}
              aria-expanded={isOpen}
            >
              <span className="an-dept-chip">Year {year}</span>
              <span className="an-table-count">
                {count} {count === 1 ? "student" : "students"}
              </span>
              <IconChevronDown
                className={`an-opp-group-chevron${isOpen ? " an-opp-group-chevron--open" : ""}`}
              />
            </button>
            {isOpen &&
              (group?.loading && !group.list.length ? (
                <div className="an-state">
                  <Spinner center label="Loading" />
                </div>
              ) : !group || group.list.length === 0 ? (
                <p className="an-empty">No students in Year {year}.</p>
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Branch</th>
                          <th>Email</th>
                          <th>Registered</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.list.map((s) => (
                          <tr
                            key={s._id}
                            className="an-row-clickable"
                            tabIndex={0}
                            aria-label={`View ${s.name}'s profile`}
                            onClick={() => onView(s._id)}
                            onKeyDown={(e) => e.key === "Enter" && onView(s._id)}
                          >
                            <td>
                              <div className="an-person">
                                <Avatar name={s.name} image={s.profileImage} size={30} />
                                <span>{s.name}</span>
                              </div>
                            </td>
                            <td>{s.branch || "-"}</td>
                            <td className="an-email">{s.email}</td>
                            <td>{fmtDate(s.createdAt)}</td>
                            <td>
                              <ModerationActions
                                person={s}
                                onBan={onBan}
                                onUnban={onUnban}
                                onDelete={onDelete}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {group.hasMore && (
                    <div className="an-more">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => loadYear(year, true)}
                        disabled={group.loading}
                      >
                        {group.loading ? "Loading…" : "Load more"}
                      </Button>
                    </div>
                  )}
                </>
              ))}
          </section>
        );
      })}
    </>
  );
}
