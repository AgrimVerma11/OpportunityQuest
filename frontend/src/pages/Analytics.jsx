import { useCallback, useEffect, useState } from "react";

import Navbar from "./Navbar";
import Avatar from "../components/Avatar";
import StatusBadge from "../components/StatusBadge";
import { fetchWithAuth } from "../utils/api";
import "./Analytics.css";

const FUNNEL_ORDER = [
  "Applied",
  "Viewed",
  "Shortlisted",
  "Selected",
  "Rejected",
  "Withdrawn",
];
const CATEGORY_ORDER = ["Internship", "Research", "Paid Gig", "Faculty Project"];
const FACULTY_ORDER = ["Active", "Pending", "Rejected", "Suspended"];

const TABS = ["Overview", "Faculty", "Students"];

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const toneOf = (label) => label.toLowerCase().replace(/\s+/g, "-");

// A labelled horizontal bar, colored by its `tone` and sized to the section max.
function BarRow({ label, value, max, tone }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="an-bar-row">
      <span className="an-bar-label">{label}</span>
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
  const [tab, setTab] = useState("Overview");

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [faculty, setFaculty] = useState(null);
  const [students, setStudents] = useState(null); // { list, total, page, hasMore }
  const [studentsLoading, setStudentsLoading] = useState(false);

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

  const loadStudents = useCallback(async (page, append) => {
    setStudentsLoading(true);
    try {
      const res = await fetchWithAuth(`/admin/students?page=${page}&limit=20`);
      if (res?.success) {
        setStudents((prev) => ({
          list: append && prev ? [...prev.list, ...res.students] : res.students,
          total: res.total,
          page: res.page,
          hasMore: res.hasMore,
        }));
      }
    } catch {
      /* leave as-is */
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  // Lazy-load each roster the first time its tab is opened.
  useEffect(() => {
    if (tab === "Faculty" && faculty === null) loadFaculty();
    if (tab === "Students" && students === null) loadStudents(1, false);
  }, [tab, faculty, students, loadFaculty, loadStudents]);

  const shell = (inner) => (
    <>
      <Navbar />
      <div className="an-container">
        <div className="an-inner">
          <div className="an-header">
            <h1>Analytics</h1>
            <p>An overview of activity across your institution.</p>
          </div>
          <div className="an-tabs">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
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
    </>
  );

  if (loading) return shell(<p className="an-state">Loading…</p>);
  if (error) return shell(<p className="an-state">{error}</p>);
  if (!analytics) return null;

  if (tab === "Faculty") return shell(<FacultyTable rows={faculty} />);
  if (tab === "Students") {
    return shell(
      <StudentsTable
        data={students}
        loading={studentsLoading}
        onMore={() => loadStudents((students?.page || 1) + 1, true)}
      />
    );
  }

  return shell(<Overview a={analytics} />);
}

// ── Overview ──────────────────────────────────────────────────────

function Overview({ a }) {
  const {
    kpis,
    applicationFunnel,
    opportunitiesByCategory,
    facultyByStatus,
    topOpportunities,
    applicationsTrend,
  } = a;

  const funnelMax = Math.max(1, ...FUNNEL_ORDER.map((s) => applicationFunnel[s] || 0));
  const catMax = Math.max(1, ...CATEGORY_ORDER.map((c) => opportunitiesByCategory[c] || 0));
  const trendMax = Math.max(1, ...applicationsTrend.map((d) => d.count));
  const trendTotal = applicationsTrend.reduce((s, d) => s + d.count, 0);

  const kpiCards = [
    { label: "Students", value: kpis.students },
    { label: "Active Faculty", value: kpis.activeFaculty },
    {
      label: "Pending Approvals",
      value: kpis.pendingFaculty,
      warn: kpis.pendingFaculty > 0,
    },
    { label: "Active Opportunities", value: kpis.activeOpportunities },
    { label: "Total Applications", value: kpis.totalApplications },
  ];

  // A few evenly-spaced date ticks under the trend.
  const ticks = [0, 9, 19, 29]
    .map((i) => applicationsTrend[i]?.date.slice(5))
    .filter(Boolean);

  return (
    <>
      <div className="an-kpis">
        {kpiCards.map((k) => (
          <div className={`an-kpi${k.warn ? " warn" : ""}`} key={k.label}>
            <span className="an-kpi-value">{k.value}</span>
            <span className="an-kpi-label">{k.label}</span>
          </div>
        ))}
      </div>

      <div className="an-grid">
        <section className="an-card">
          <h2>Application funnel</h2>
          {FUNNEL_ORDER.map((s) => (
            <BarRow
              key={s}
              label={s}
              value={applicationFunnel[s] || 0}
              max={funnelMax}
              tone={toneOf(s)}
            />
          ))}
        </section>

        <section className="an-card">
          <h2>Opportunities by category</h2>
          {CATEGORY_ORDER.map((c) => (
            <BarRow
              key={c}
              label={c}
              value={opportunitiesByCategory[c] || 0}
              max={catMax}
              tone={toneOf(c)}
            />
          ))}
        </section>

        <section className="an-card">
          <h2>Faculty by status</h2>
          <div className="an-stat-row">
            {FACULTY_ORDER.map((s) => (
              <div className={`an-stat ${toneOf(s)}`} key={s}>
                <span className="an-stat-value">{facultyByStatus[s] || 0}</span>
                <span className="an-stat-label">{s}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="an-card">
          <h2>Top opportunities</h2>
          {topOpportunities.length === 0 ? (
            <p className="an-empty">No applications yet.</p>
          ) : (
            <ol className="an-top-list">
              {topOpportunities.map((o, i) => (
                <li key={o.opportunityId}>
                  <span className="an-top-rank">{i + 1}</span>
                  <span className="an-top-title">{o.title}</span>
                  <span className="an-top-count">{o.applications}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="an-card an-trend-card">
        <div className="an-trend-head">
          <h2>Applications — last 30 days</h2>
          <span className="an-trend-total">{trendTotal} total</span>
        </div>
        <div className="an-trend">
          {applicationsTrend.map((d) => (
            <span
              key={d.date}
              className="an-trend-bar"
              style={{ height: `${Math.round((d.count / trendMax) * 100)}%` }}
              title={`${d.date}: ${d.count}`}
            />
          ))}
        </div>
        <div className="an-trend-axis">
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </section>
    </>
  );
}

// ── Faculty roster ────────────────────────────────────────────────

function FacultyTable({ rows }) {
  if (rows === null) return <p className="an-state">Loading…</p>;
  if (rows.length === 0)
    return (
      <section className="an-card">
        <p className="an-empty">No faculty in your institution yet.</p>
      </section>
    );

  return (
    <section className="an-card an-table-card">
      <div className="an-table-scroll">
        <table className="an-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Department</th>
              <th>Employee ID</th>
              <th>Status</th>
              <th>Registered</th>
              <th>Approved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f._id}>
                <td>
                  <div className="an-person">
                    <Avatar name={f.name} size={30} />
                    <span>{f.name}</span>
                  </div>
                </td>
                <td>{f.department || "—"}</td>
                <td>{f.employeeId || "—"}</td>
                <td>
                  <StatusBadge status={f.accountStatus} />
                </td>
                <td>{fmtDate(f.createdAt)}</td>
                <td>{fmtDate(f.approvedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Student roster ────────────────────────────────────────────────

function StudentsTable({ data, loading, onMore }) {
  if (!data && loading) return <p className="an-state">Loading…</p>;
  if (!data) return null;
  if (data.list.length === 0)
    return (
      <section className="an-card">
        <p className="an-empty">No students registered yet.</p>
      </section>
    );

  return (
    <section className="an-card an-table-card">
      <div className="an-table-count">{data.total} students</div>
      <div className="an-table-scroll">
        <table className="an-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Branch</th>
              <th>Year</th>
              <th>Email</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {data.list.map((s) => (
              <tr key={s._id}>
                <td>
                  <div className="an-person">
                    <Avatar name={s.name} image={s.profileImage} size={30} />
                    <span>{s.name}</span>
                  </div>
                </td>
                <td>{s.branch || "—"}</td>
                <td>{s.year || "—"}</td>
                <td className="an-email">{s.email}</td>
                <td>{fmtDate(s.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.hasMore && (
        <div className="an-more">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onMore}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}
