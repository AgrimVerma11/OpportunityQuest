import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Overview,
  OpportunitiesTab,
  ActivityTrend,
  FacultyEngagement,
  FacultyTable,
  StudentsTab,
  FacultyDetailModal,
} from "./Analytics";

vi.mock("../utils/api", () => ({
  fetchWithAuth: vi.fn(),
}));
import { fetchWithAuth } from "../utils/api";

const inDays = (n) =>
  new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

const baseAnalytics = {
  kpis: {
    students: 10,
    activeFaculty: 5,
    pendingFaculty: 2,
    activeOpportunities: 4,
    totalApplications: 80,
  },
  // Cumulative "reached at least this stage" — not a current-status snapshot,
  // see cumulativeFunnelByOrg on the backend. Deliberately not internally
  // consistent with kpis.totalApplications here; this fixture is illustrative.
  applicationFunnel: {
    Applied: 20,
    Viewed: 15,
    Shortlisted: 8,
    Selected: 5,
    Rejected: 3,
    Withdrawn: 2,
  },
  // Distinct from applicationFunnel.Applied above (which is cumulative, i.e.
  // "everyone who ever applied") — this is the literal "still untouched"
  // count, deliberately a different number so a test that reads the wrong
  // field would be caught immediately.
  awaitingFirstReview: 6,
  opportunitiesByStatus: { Active: 4, Expired: 1, Archived: 2, Closed: 1 },
  facultyByStatus: { Active: 5, Pending: 2, Rejected: 0, Suspended: 0 },
  topOpportunities: [],
  applicationsTrend: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    count: 0,
  })),
};

// Routes the mocked fetchWithAuth by endpoint, like the real backend would —
// each test only needs to override the endpoints it cares about. `list`
// (used by OpportunitiesTab tests) takes priority over `opportunities`
// (Overview's active-opportunities snapshot) for any /admin/opportunities
// request, since the two can produce the identical URL (?status=Active) and
// a test exercising OpportunitiesTab is never also asserting on Overview's
// snapshot in the same render.
function mockEndpoints({
  demand,
  opportunities,
  funnel,
  list,
  facultyActivity,
  studentEngagement,
  studentsList,
  yearCounts,
  branches,
  facultyDetail,
  trend,
} = {}) {
  fetchWithAuth.mockImplementation(async (url) => {
    if (url === "/admin/analytics/category-demand") {
      return demand ?? { success: true, demand: [] };
    }
    if (url.startsWith("/admin/analytics/faculty-activity")) {
      return facultyActivity ?? { success: true, faculty: [], participation: 0 };
    }
    if (url.startsWith("/admin/faculty/")) {
      return facultyDetail ?? { success: true, faculty: null };
    }
    if (url.startsWith("/admin/analytics/student-engagement")) {
      return (
        studentEngagement ?? { success: true, engagement: { byYear: {}, byCategory: {} } }
      );
    }
    if (url.startsWith("/admin/analytics/trend")) {
      return trend ?? { success: true, trend: [] };
    }
    if (url.startsWith("/admin/analytics/funnel")) {
      return funnel ?? { success: true, funnel: baseAnalytics.applicationFunnel };
    }
    if (url.startsWith("/admin/students/year-counts")) {
      return yearCounts ?? { success: true, counts: {} };
    }
    if (url.startsWith("/admin/students/branches")) {
      return branches ?? { success: true, branches: [] };
    }
    if (url.startsWith("/admin/students")) {
      return studentsList ?? { success: true, students: [], total: 0, hasMore: false };
    }
    if (url.startsWith("/admin/opportunities")) {
      if (list !== undefined) return list;
      if (url === "/admin/opportunities?status=Active") {
        return opportunities ?? { success: true, opportunities: [] };
      }
      return { success: true, opportunities: [] };
    }
    throw new Error(`Unexpected fetchWithAuth call: ${url}`);
  });
}

const noop = () => {};

beforeEach(() => {
  fetchWithAuth.mockReset();
});

describe("Overview — KPI row", () => {
  it("derives Apps / Active Opportunity and Selection Rate from the existing KPI/funnel figures", async () => {
    mockEndpoints();
    render(
      <Overview
        a={baseAnalytics}
        onSelectTab={noop}
        navigate={noop}
        onOpenOpportunities={noop}
      />
    );

    // 80 total applications / 4 active opportunities.
    expect(await screen.findByText("20.0")).toBeInTheDocument();
    // Selected 5 / (Selected 5 + Rejected 3) = 62.5% → rounds to 63%.
    expect(screen.getByText("63%")).toBeInTheDocument();
  });

  it("makes Students, Active Faculty and Active Opportunities clickable; leaves Total Applications static", async () => {
    mockEndpoints();
    const onSelectTab = vi.fn();
    const onOpenOpportunities = vi.fn();
    const user = userEvent.setup();
    render(
      <Overview
        a={baseAnalytics}
        onSelectTab={onSelectTab}
        navigate={noop}
        onOpenOpportunities={onOpenOpportunities}
      />
    );
    await screen.findByText("20.0");

    await user.click(screen.getByText("Students").closest("button"));
    expect(onSelectTab).toHaveBeenCalledWith("Students");

    await user.click(screen.getByText("Active Faculty").closest("button"));
    expect(onSelectTab).toHaveBeenCalledWith("Faculty");

    // Active Opportunities now drills into the Opportunities tab (Phase 3).
    const activeOppsButton = screen.getByText("Active Opportunities").closest("button");
    expect(activeOppsButton).not.toBeNull();
    await user.click(activeOppsButton);
    expect(onOpenOpportunities).toHaveBeenCalledWith("Active", "default");

    // Total Applications still has nowhere to drill into (the Applications
    // tab was tried and pulled pending a conversation with a faculty admin)
    // — must stay static.
    expect(screen.getByText("Total Applications").closest("button")).toBeNull();
  });

  it("gives every KPI tile's icon tile a real glyph, not just an empty tinted square", async () => {
    mockEndpoints();
    render(
      <Overview
        a={baseAnalytics}
        onSelectTab={noop}
        navigate={noop}
        onOpenOpportunities={noop}
      />
    );
    await screen.findByText("20.0");

    for (const label of [
      "Students",
      "Active Faculty",
      "Active Opportunities",
      "Total Applications",
      "Apps / Active Opportunity",
      "Selection Rate",
    ]) {
      const tile = screen.getByText(label).closest(".oq-stat");
      const iconTile = tile.querySelector(".oq-stat__icon");
      expect(iconTile).not.toBeNull();
      expect(iconTile.querySelector("svg")).not.toBeNull();
    }
  });
});

describe("Overview — Needs attention", () => {
  it("counts opportunities closing within 7 days and with zero applications, from the live listing", async () => {
    mockEndpoints({
      opportunities: {
        success: true,
        opportunities: [
          { title: "Closing very soon", deadline: inDays(3), applicationsCount: 2 },
          { title: "Not closing soon", deadline: inDays(20), applicationsCount: 5 },
          { title: "Needs applicants", deadline: inDays(15), applicationsCount: 0 },
        ],
      },
    });
    render(
      <Overview
        a={baseAnalytics}
        onSelectTab={noop}
        navigate={noop}
        onOpenOpportunities={noop}
      />
    );

    await waitFor(() =>
      expect(screen.getByText(/opportunity is closing within 7 days/)).toBeInTheDocument()
    );
    // Exactly one of the three is both zero-application and Active.
    expect(screen.getByText(/opportunity has received zero applications/)).toBeInTheDocument();
    // awaitingFirstReview (6), not the funnel's cumulative Applied (20).
    expect(screen.getByText("6", { selector: "strong" })).toBeInTheDocument();
  });

  it("drills the closing-soon and zero-applications rows into the Opportunities tab, sorted appropriately", async () => {
    mockEndpoints();
    const onOpenOpportunities = vi.fn();
    const user = userEvent.setup();
    render(
      <Overview
        a={baseAnalytics}
        onSelectTab={noop}
        navigate={noop}
        onOpenOpportunities={onOpenOpportunities}
      />
    );
    await screen.findByText("20.0");

    await user.click(
      screen.getByText(/closing within 7 days/).closest("button")
    );
    expect(onOpenOpportunities).toHaveBeenCalledWith("Active", "deadline");

    await user.click(
      screen.getByText(/received zero applications/).closest("button")
    );
    expect(onOpenOpportunities).toHaveBeenCalledWith("Active", "applications");

    // "Awaiting first review" is informational only — no destination exists
    // to drill into (the Applications tab was tried and pulled).
    expect(screen.getByText(/awaiting first review/).closest("button")).toBeNull();
  });

  it("navigates to /approvals when the pending-approvals row is clicked", async () => {
    mockEndpoints();
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(
      <Overview
        a={baseAnalytics}
        onSelectTab={noop}
        navigate={navigate}
        onOpenOpportunities={noop}
      />
    );
    await screen.findByText("20.0");

    await user.click(
      screen.getByText(/faculty.*pending your review/).closest("button")
    );
    expect(navigate).toHaveBeenCalledWith("/approvals");
  });
});

describe("Overview — Application funnel", () => {
  it("shows stage-to-stage conversion, not just share-of-total", async () => {
    mockEndpoints();
    render(
      <Overview
        a={baseAnalytics}
        onSelectTab={noop}
        navigate={noop}
        onOpenOpportunities={noop}
      />
    );
    await screen.findByText("20.0");

    // Viewed 15 / Applied 20 = 75%.
    expect(screen.getByText(/75% of applied went on to viewed/i)).toBeInTheDocument();
    // Shortlisted 8 / Viewed 15 = 53% (rounded).
    expect(screen.getByText(/53% of viewed went on to shortlisted/i)).toBeInTheDocument();
  });

  it("refetches the funnel scoped to a category when a category chip is clicked", async () => {
    const categoryFunnel = {
      Applied: 7,
      Viewed: 5,
      Shortlisted: 2,
      Selected: 1,
      Rejected: 1,
      Withdrawn: 0,
    };
    mockEndpoints({ funnel: { success: true, funnel: categoryFunnel } });
    const user = userEvent.setup();
    render(
      <Overview
        a={baseAnalytics}
        onSelectTab={noop}
        navigate={noop}
        onOpenOpportunities={noop}
      />
    );
    await screen.findByText("20.0");

    await user.click(screen.getByRole("button", { name: "Research" }));

    await waitFor(() =>
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "/admin/analytics/funnel?category=Research"
      )
    );
    const appliedRow = screen.getByText("Applied").closest(".an-bar-row");
    await waitFor(() =>
      expect(within(appliedRow).getByText("7")).toBeInTheDocument()
    );
  });

  it("shows Rejected and Withdrawn as outcomes outside the funnel, not as stages", async () => {
    mockEndpoints();
    render(
      <Overview
        a={baseAnalytics}
        onSelectTab={noop}
        navigate={noop}
        onOpenOpportunities={noop}
      />
    );
    await screen.findByText("20.0");

    expect(screen.queryByText("Rejected", { selector: ".an-bar-label" })).toBeNull();
    expect(screen.getByText("Rejected", { selector: ".an-outcome-label" })).toBeInTheDocument();
    expect(screen.getByText("Withdrawn", { selector: ".an-outcome-label" })).toBeInTheDocument();
  });
});

describe("Overview — Applications per opportunity (category demand)", () => {
  it("renders each category's postings as a caption under its bar", async () => {
    mockEndpoints({
      demand: {
        success: true,
        demand: [
          { category: "Internship", postings: 5, applications: 120 },
          { category: "Research", postings: 3, applications: 60 },
          { category: "Paid Gig", postings: 2, applications: 12 },
          { category: "Faculty Project", postings: 2, applications: 34 },
        ],
      },
    });
    render(
      <Overview
        a={baseAnalytics}
        onSelectTab={noop}
        navigate={noop}
        onOpenOpportunities={noop}
      />
    );

    expect(await screen.findByText("5 postings")).toBeInTheDocument();
    expect(screen.getByText("3 postings")).toBeInTheDocument();
  });
});

describe("Overview — Top opportunities", () => {
  const topOpportunitiesAnalytics = {
    ...baseAnalytics,
    topOpportunities: [
      { opportunityId: "opp-1", title: "ML Research Assistant", category: "Research", applications: 40 },
      { opportunityId: "opp-2", title: "Frontend Intern", category: "Internship", applications: 10 },
    ],
  };

  it("renders each row's rank, category and a volume bar relative to the top entry", async () => {
    mockEndpoints();
    render(
      <Overview
        a={topOpportunitiesAnalytics}
        onSelectTab={noop}
        navigate={noop}
        onOpenOpportunities={noop}
      />
    );

    expect(await screen.findByText("ML Research Assistant")).toBeInTheDocument();
    const firstRow = screen.getByText("ML Research Assistant").closest(".an-top-row");
    expect(within(firstRow).getByText("Research")).toBeInTheDocument();
    expect(within(firstRow).getByText("40")).toBeInTheDocument();
    expect(firstRow.querySelector(".an-top-fill")).toHaveStyle({ width: "100%" });

    const secondRow = screen.getByText("Frontend Intern").closest(".an-top-row");
    // 10 / 40 of the top entry.
    expect(secondRow.querySelector(".an-top-fill")).toHaveStyle({ width: "25%" });
  });

  it("navigates to the opportunity's detail page when a row is clicked", async () => {
    mockEndpoints();
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(
      <Overview
        a={topOpportunitiesAnalytics}
        onSelectTab={noop}
        navigate={navigate}
        onOpenOpportunities={noop}
      />
    );
    await screen.findByText("ML Research Assistant");

    await user.click(screen.getByText("Frontend Intern").closest("button"));
    expect(navigate).toHaveBeenCalledWith("/opportunity/opp-2");
  });
});

describe("Overview — Opportunity status tiles", () => {
  it("drills each status tile into the Opportunities tab filtered to that status", async () => {
    mockEndpoints();
    const onOpenOpportunities = vi.fn();
    const user = userEvent.setup();
    render(
      <Overview
        a={baseAnalytics}
        onSelectTab={noop}
        navigate={noop}
        onOpenOpportunities={onOpenOpportunities}
      />
    );
    await screen.findByText("20.0");

    await user.click(screen.getByText("Expired").closest("button"));
    expect(onOpenOpportunities).toHaveBeenCalledWith("Expired", "default");
  });
});

describe("Overview — Activity trend (ActivityTrend)", () => {
  const trend30 = baseAnalytics.applicationsTrend.map((d, i) => ({
    ...d,
    count: i === 29 ? 4 : 0,
  }));

  it("defaults to 30 days / Applications, reusing the bundled trend without an extra fetch", async () => {
    render(<ActivityTrend initialTrend={trend30} />);
    expect(await screen.findByText("Applications in the last 30 days")).toBeInTheDocument();
    expect(screen.getByText("4 total")).toBeInTheDocument();
    expect(fetchWithAuth).not.toHaveBeenCalled();
  });

  it("refetches from /admin/analytics/trend when the period is changed", async () => {
    mockEndpoints({
      trend: {
        success: true,
        trend: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-09-${String(i + 1).padStart(2, "0")}`,
          count: i === 6 ? 9 : 1,
        })),
      },
    });
    const user = userEvent.setup();
    render(<ActivityTrend initialTrend={trend30} />);
    await screen.findByText("Applications in the last 30 days");

    await user.click(screen.getByRole("button", { name: "7 days" }));

    await waitFor(() =>
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "/admin/analytics/trend?period=7d&series=applications"
      )
    );
    expect(await screen.findByText("Applications in the last 7 days")).toBeInTheDocument();
    expect(screen.getByText("15 total")).toBeInTheDocument();
  });

  it("refetches from /admin/analytics/trend when the series is changed, and relabels the unit", async () => {
    mockEndpoints({
      trend: {
        success: true,
        trend: [{ date: "2026-09-30", count: 3 }],
      },
    });
    const user = userEvent.setup();
    render(<ActivityTrend initialTrend={trend30} />);
    await screen.findByText("Applications in the last 30 days");

    await user.click(screen.getByRole("button", { name: "Signups" }));

    await waitFor(() =>
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "/admin/analytics/trend?period=30d&series=signups"
      )
    );
    expect(await screen.findByText("Signups in the last 30 days")).toBeInTheDocument();
  });

  it("shows a series-aware empty state when the trend is all zero", async () => {
    mockEndpoints({ trend: { success: true, trend: [{ date: "2026-09-30", count: 0 }] } });
    const user = userEvent.setup();
    render(<ActivityTrend initialTrend={trend30.map((d) => ({ ...d, count: 0 }))} />);
    await screen.findByText("Applications in the last 30 days");

    await user.click(screen.getByRole("button", { name: "Postings" }));
    expect(await screen.findByText("No postings yet.")).toBeInTheDocument();
  });
});

// ── Opportunities tab ─────────────────────────────────────────────

const oppRows = [
  {
    _id: "opp-1",
    title: "ML Research Assistant",
    category: "Research",
    status: "Active",
    deadline: inDays(3),
    applicationsCount: 4,
    postedBy: "Dr. Meera Iyer",
  },
  {
    _id: "opp-2",
    title: "Frontend Intern",
    category: "Internship",
    status: "Active",
    deadline: inDays(20),
    applicationsCount: 0,
    postedBy: "Prof. Arjun Nair",
  },
];

describe("OpportunitiesTab", () => {
  it("fetches with the status and sort from `filter`, and renders each row's fields", async () => {
    mockEndpoints({ list: { success: true, opportunities: oppRows } });
    render(
      <OpportunitiesTab
        filter={{ status: "Active", sort: "deadline" }}
        onFilterChange={noop}
      />
    );

    await waitFor(() =>
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "/admin/opportunities?status=Active&sort=deadline"
      )
    );
    expect(await screen.findByText("ML Research Assistant")).toBeInTheDocument();
    expect(screen.getByText("Dr. Meera Iyer")).toBeInTheDocument();
    expect(screen.getByText("Prof. Arjun Nair")).toBeInTheDocument();
  });

  it("omits status/sort from the query when they're at their defaults", async () => {
    mockEndpoints({ list: { success: true, opportunities: [] } });
    render(
      <OpportunitiesTab filter={{ status: "All", sort: "default" }} onFilterChange={noop} />
    );
    await waitFor(() =>
      expect(fetchWithAuth).toHaveBeenCalledWith("/admin/opportunities")
    );
  });

  it("only shows Clear filters when status or sort has been changed from its default, and resets both when clicked", async () => {
    mockEndpoints({ list: { success: true, opportunities: oppRows } });
    const user = userEvent.setup();

    const { rerender } = render(
      <OpportunitiesTab filter={{ status: "All", sort: "default" }} onFilterChange={noop} />
    );
    await screen.findByText("ML Research Assistant");
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();

    const onFilterChange = vi.fn();
    rerender(
      <OpportunitiesTab
        filter={{ status: "Active", sort: "deadline" }}
        onFilterChange={onFilterChange}
      />
    );
    const clearButton = await screen.findByRole("button", { name: "Clear filters" });
    await user.click(clearButton);
    expect(onFilterChange).toHaveBeenCalledWith({ status: "All", sort: "default" });
  });

  it("calls onFilterChange with the clicked status, keeping the current sort", async () => {
    mockEndpoints({ list: { success: true, opportunities: oppRows } });
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    render(
      <OpportunitiesTab
        filter={{ status: "All", sort: "applications" }}
        onFilterChange={onFilterChange}
      />
    );
    await screen.findByText("ML Research Assistant");

    await user.click(screen.getByRole("button", { name: "Active" }));
    expect(onFilterChange).toHaveBeenCalledWith({ status: "Active", sort: "applications" });
  });

  it("calls onFilterChange with the clicked sort, keeping the current status", async () => {
    mockEndpoints({ list: { success: true, opportunities: oppRows } });
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    render(
      <OpportunitiesTab
        filter={{ status: "Active", sort: "default" }}
        onFilterChange={onFilterChange}
      />
    );
    await screen.findByText("ML Research Assistant");

    await user.click(screen.getByRole("button", { name: "Nearest deadline" }));
    expect(onFilterChange).toHaveBeenCalledWith({ status: "Active", sort: "deadline" });
  });

  it("groups rows by category and hides the Category column when 'By category' is selected", async () => {
    mockEndpoints({ list: { success: true, opportunities: oppRows } });
    const user = userEvent.setup();
    render(
      <OpportunitiesTab filter={{ status: "All", sort: "default" }} onFilterChange={noop} />
    );
    await screen.findByText("ML Research Assistant");

    await user.click(screen.getByRole("button", { name: "By category" }));

    // Two categories, one opportunity each — singular label, two groups.
    expect(screen.queryAllByText("1 opportunity")).toHaveLength(2);
    expect(screen.queryByRole("columnheader", { name: "Category" })).toBeNull();
  });

  it("shows an empty state scoped to the active status filter when there are no results", async () => {
    mockEndpoints({ list: { success: true, opportunities: [] } });
    render(
      <OpportunitiesTab filter={{ status: "Closed", sort: "default" }} onFilterChange={noop} />
    );
    expect(await screen.findByText("No opportunities in Closed")).toBeInTheDocument();
  });
});

// ── Faculty engagement ────────────────────────────────────────────

const facultyRows = [
  { facultyId: "f1", name: "Prof. Arjun Nair", department: "Computer Science", postings: 3, apps: 127 },
  { facultyId: "f2", name: "Dr. Meera Iyer", department: "Computer Science", postings: 2, apps: 53 },
];

describe("FacultyEngagement", () => {
  it("defaults to Month mode, fetching with mode=month, a month token, and the default topN", async () => {
    mockEndpoints({
      facultyActivity: { success: true, faculty: facultyRows, participation: 6 },
    });
    render(<FacultyEngagement activeFacultyCount={12} onViewProfile={noop} />);

    await screen.findByText("Prof. Arjun Nair");
    const calledUrl = fetchWithAuth.mock.calls[0][0];
    expect(calledUrl).toContain("mode=month");
    expect(calledUrl).toContain("topN=5");
    // URLSearchParams encodes the space in "Sep 2026" as "+".
    expect(calledUrl).toMatch(/month=[A-Za-z]{3}\+\d{4}/);
  });

  it("steps the month picker backward/forward, disabling forward at the most recent month", async () => {
    mockEndpoints({
      facultyActivity: { success: true, faculty: facultyRows, participation: 6 },
    });
    const user = userEvent.setup();
    render(<FacultyEngagement activeFacultyCount={12} onViewProfile={noop} />);
    await screen.findByText("Prof. Arjun Nair");

    // Starts on the current (most recent) month — nothing to step forward to.
    expect(screen.getByRole("button", { name: "Later month" })).toBeDisabled();

    fetchWithAuth.mockClear();
    await user.click(screen.getByRole("button", { name: "Earlier month" }));

    await waitFor(() => expect(fetchWithAuth).toHaveBeenCalled());
    const requestedMonth = new URL(
      fetchWithAuth.mock.calls.at(-1)[0],
      "http://x"
    ).searchParams.get("month");
    expect(requestedMonth).not.toBeNull();

    // Having stepped back once, forward is now available again.
    expect(screen.getByRole("button", { name: "Later month" })).not.toBeDisabled();
  });

  it("shows the participation figure the backend returned, not just the leaderboard's (possibly capped) length", async () => {
    mockEndpoints({
      facultyActivity: { success: true, faculty: facultyRows, participation: 6 },
    });
    render(<FacultyEngagement activeFacultyCount={12} onViewProfile={noop} />);
    expect(await screen.findByText(/6 of 12 active faculty posted/)).toBeInTheDocument();
  });

  it("calls onViewProfile with the faculty id when a leaderboard name is clicked", async () => {
    mockEndpoints({
      facultyActivity: { success: true, faculty: facultyRows, participation: 6 },
    });
    const onViewProfile = vi.fn();
    const user = userEvent.setup();
    render(<FacultyEngagement activeFacultyCount={12} onViewProfile={onViewProfile} />);

    await user.click(await screen.findByText("Prof. Arjun Nair"));
    expect(onViewProfile).toHaveBeenCalledWith("f1");
  });

  it("switches to Year to Date, refetching with mode=ytd and no month", async () => {
    mockEndpoints({
      facultyActivity: { success: true, faculty: facultyRows, participation: 6 },
    });
    const user = userEvent.setup();
    render(<FacultyEngagement activeFacultyCount={12} onViewProfile={noop} />);
    await screen.findByText("Prof. Arjun Nair");

    await user.click(screen.getByRole("button", { name: "Year to Date" }));

    await waitFor(() => {
      const lastUrl = fetchWithAuth.mock.calls.at(-1)[0];
      expect(lastUrl).toContain("mode=ytd");
      expect(lastUrl).not.toContain("month=");
    });
    expect(
      await screen.findByText(/6 of 12 active faculty posted so far this year/)
    ).toBeInTheDocument();
  });

  it("switches to Custom Range, showing From/To month pickers and refetching with from/to", async () => {
    mockEndpoints({
      facultyActivity: { success: true, faculty: facultyRows, participation: 6 },
    });
    const user = userEvent.setup();
    render(<FacultyEngagement activeFacultyCount={12} onViewProfile={noop} />);
    await screen.findByText("Prof. Arjun Nair");

    await user.click(screen.getByRole("button", { name: "Custom Range" }));

    await waitFor(() => {
      const lastUrl = fetchWithAuth.mock.calls.at(-1)[0];
      expect(lastUrl).toContain("mode=custom");
      expect(lastUrl).toMatch(/from=[A-Za-z]{3}\+\d{4}/);
      expect(lastUrl).toMatch(/to=[A-Za-z]{3}\+\d{4}/);
    });
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("to")).toBeInTheDocument();
  });

  it("changes topN and refetches with the new value", async () => {
    mockEndpoints({
      facultyActivity: { success: true, faculty: facultyRows, participation: 6 },
    });
    const user = userEvent.setup();
    render(<FacultyEngagement activeFacultyCount={12} onViewProfile={noop} />);
    await screen.findByText("Prof. Arjun Nair");

    await user.click(screen.getByRole("button", { name: "Top 10" }));

    await waitFor(() => {
      const lastUrl = fetchWithAuth.mock.calls.at(-1)[0];
      expect(lastUrl).toContain("topN=10");
    });
  });

  it("defaults to ranking by applications, and switches to ranking by postings", async () => {
    mockEndpoints({
      facultyActivity: { success: true, faculty: facultyRows, participation: 6 },
    });
    const user = userEvent.setup();
    render(<FacultyEngagement activeFacultyCount={12} onViewProfile={noop} />);
    await screen.findByText("Prof. Arjun Nair");

    expect(fetchWithAuth.mock.calls[0][0]).toContain("sortBy=apps");

    await user.click(screen.getByRole("button", { name: "Postings" }));

    await waitFor(() => {
      const lastUrl = fetchWithAuth.mock.calls.at(-1)[0];
      expect(lastUrl).toContain("sortBy=postings");
    });
  });

  it("shows postings and applications, both labelled, on every leaderboard row", async () => {
    mockEndpoints({
      facultyActivity: { success: true, faculty: facultyRows, participation: 6 },
    });
    render(<FacultyEngagement activeFacultyCount={12} onViewProfile={noop} />);
    const row = (await screen.findByText("Prof. Arjun Nair")).closest("li");

    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByText("postings")).toBeInTheDocument();
    expect(within(row).getByText("127")).toBeInTheDocument();
    expect(within(row).getByText("applications")).toBeInTheDocument();
  });
});

// ── Faculty roster grouping ───────────────────────────────────────

const facultyRosterRows = [
  {
    _id: "u1",
    name: "Prof. Arjun Nair",
    department: "Computer Science",
    accountStatus: "Active",
    createdAt: inDays(-30),
    opportunitiesPosted: 3,
  },
  {
    _id: "u2",
    name: "Dr. Meera Iyer",
    department: "Computer Science",
    accountStatus: "Active",
    createdAt: inDays(-20),
  },
  {
    _id: "u3",
    name: "Dr. Rohan Malhotra",
    department: "Chemistry",
    accountStatus: "Active",
    createdAt: inDays(-10),
  },
  {
    _id: "u4",
    name: "Prof. No Department",
    department: "",
    accountStatus: "Active",
    createdAt: inDays(-5),
  },
];

describe("FacultyTable — grouping", () => {
  it("defaults to a flat list with a Department column", () => {
    render(
      <FacultyTable rows={facultyRosterRows} onView={noop} onBan={noop} onUnban={noop} onDelete={noop} />
    );
    expect(screen.getByRole("columnheader", { name: "Department" })).toBeInTheDocument();
    expect(screen.getByText("Prof. Arjun Nair")).toBeInTheDocument();
  });

  it("shows how many opportunities each faculty member has posted, defaulting to 0 when unset", () => {
    render(
      <FacultyTable rows={facultyRosterRows} onView={noop} onBan={noop} onUnban={noop} onDelete={noop} />
    );
    expect(screen.getByRole("columnheader", { name: "Posted" })).toBeInTheDocument();
    const arjunRow = screen.getByText("Prof. Arjun Nair").closest("tr");
    expect(within(arjunRow).getByText("3")).toBeInTheDocument();
    // u4 has no opportunitiesPosted field at all — must render 0, not blank.
    const noDeptRow = screen.getByText("Prof. No Department").closest("tr");
    expect(within(noDeptRow).getByText("0")).toBeInTheDocument();
  });

  it("groups by department, hides the Department column, and buckets a blank department separately", async () => {
    const user = userEvent.setup();
    render(
      <FacultyTable rows={facultyRosterRows} onView={noop} onBan={noop} onUnban={noop} onDelete={noop} />
    );

    await user.click(screen.getByRole("button", { name: "By department" }));

    expect(screen.queryByRole("columnheader", { name: "Department" })).toBeNull();
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByText("Chemistry")).toBeInTheDocument();
    expect(screen.getByText("No department listed")).toBeInTheDocument();
    expect(screen.getByText("2 faculty members")).toBeInTheDocument();
  });

  it("still opens the profile modal when a name is clicked, in either view", async () => {
    const onView = vi.fn();
    const user = userEvent.setup();
    render(
      <FacultyTable rows={facultyRosterRows} onView={onView} onBan={noop} onUnban={noop} onDelete={noop} />
    );
    await user.click(screen.getByText("Prof. Arjun Nair"));
    expect(onView).toHaveBeenCalledWith("u1");
  });
});

// ── Students tab ───────────────────────────────────────────────────

const studentRows = [
  {
    _id: "s1",
    name: "Ishaan Kapoor",
    branch: "CSE",
    year: 3,
    email: "ishaan@thapar.edu",
    createdAt: inDays(-30),
  },
  {
    _id: "s2",
    name: "Riya Sharma",
    branch: "ECE",
    year: 2,
    email: "riya@thapar.edu",
    createdAt: inDays(-20),
  },
];

describe("StudentsTab", () => {
  it("fetches the roster and engagement panel unfiltered by default, then re-fetches both with the clicked gender", async () => {
    mockEndpoints({
      studentsList: { success: true, students: studentRows, total: 2, hasMore: false },
    });
    const user = userEvent.setup();
    render(<StudentsTab refreshKey={0} onView={noop} onBan={noop} onUnban={noop} onDelete={noop} />);

    await screen.findByText("Ishaan Kapoor");
    expect(fetchWithAuth).toHaveBeenCalledWith("/admin/students?page=1&limit=20");
    expect(fetchWithAuth).toHaveBeenCalledWith("/admin/analytics/student-engagement");

    fetchWithAuth.mockClear();
    await user.click(screen.getByRole("button", { name: "Female" }));

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "/admin/students?page=1&limit=20&gender=Female"
      );
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "/admin/analytics/student-engagement?gender=Female"
      );
    });
  });

  it("renders a branch filter from the real values in use, composes it with gender in the roster fetch, and never sends it to the (gender-only) engagement endpoint", async () => {
    mockEndpoints({
      studentsList: { success: true, students: studentRows, total: 2, hasMore: false },
      branches: { success: true, branches: ["COE", "CSE"] },
    });
    const user = userEvent.setup();
    render(<StudentsTab refreshKey={0} onView={noop} onBan={noop} onUnban={noop} onDelete={noop} />);

    await screen.findByText("Ishaan Kapoor");
    expect(await screen.findByRole("button", { name: "COE" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CSE" })).toBeInTheDocument();

    fetchWithAuth.mockClear();
    await user.click(screen.getByRole("button", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: "COE" }));

    await waitFor(() =>
      expect(fetchWithAuth).toHaveBeenCalledWith(
        "/admin/students?page=1&limit=20&gender=Female&branch=COE"
      )
    );
    expect(fetchWithAuth).not.toHaveBeenCalledWith(
      expect.stringContaining("student-engagement?gender=Female&branch")
    );
  });

  it("shows the student-engagement panel's application totals by year and by category", async () => {
    mockEndpoints({
      studentEngagement: {
        success: true,
        engagement: {
          byYear: { 1: 5, 2: 8, 3: 3, 4: 1 },
          byCategory: { Internship: 10, Research: 4, "Paid Gig": 2, "Faculty Project": 1 },
        },
      },
    });
    render(<StudentsTab refreshKey={0} onView={noop} onBan={noop} onUnban={noop} onDelete={noop} />);

    expect(await screen.findByText("17 applications institute-wide")).toBeInTheDocument();
    const yearRow = screen.getByText("Year 2").closest(".an-bar-row");
    expect(within(yearRow).getByText("8")).toBeInTheDocument();
  });

  it("opens the profile modal when a roster row is clicked, in the default List view", async () => {
    mockEndpoints({
      studentsList: { success: true, students: studentRows, total: 2, hasMore: false },
    });
    const onView = vi.fn();
    const user = userEvent.setup();
    render(<StudentsTab refreshKey={0} onView={onView} onBan={noop} onUnban={noop} onDelete={noop} />);

    await user.click(await screen.findByText("Ishaan Kapoor"));
    expect(onView).toHaveBeenCalledWith("s1");
  });

  it("shows an empty state naming the active gender filter when the roster is empty", async () => {
    mockEndpoints({
      studentsList: { success: true, students: [], total: 0, hasMore: false },
    });
    const user = userEvent.setup();
    render(<StudentsTab refreshKey={0} onView={noop} onBan={noop} onUnban={noop} onDelete={noop} />);
    await user.click(screen.getByRole("button", { name: "Other" }));

    expect(
      await screen.findByText("No students (other) registered yet.")
    ).toBeInTheDocument();
  });

  it("By year view shows counts up front but only loads a year's roster once it's expanded", async () => {
    fetchWithAuth.mockImplementation(async (url) => {
      if (url === "/admin/analytics/student-engagement") {
        return { success: true, engagement: { byYear: {}, byCategory: {} } };
      }
      if (url === "/admin/students/year-counts") {
        return { success: true, counts: { 1: 0, 2: 1, 3: 0, 4: 0 } };
      }
      if (url === "/admin/students?page=1&limit=20&year=2") {
        return {
          success: true,
          students: [studentRows[1]],
          total: 1,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected fetchWithAuth call: ${url}`);
    });
    const user = userEvent.setup();
    render(<StudentsTab refreshKey={0} onView={noop} onBan={noop} onUnban={noop} onDelete={noop} />);

    await user.click(screen.getByRole("button", { name: "By year" }));
    expect(await screen.findByText("1 student")).toBeInTheDocument();

    // Not fetched yet — only the counts, not any year's actual roster.
    expect(
      fetchWithAuth.mock.calls.some(([url]) => url.includes("year="))
    ).toBe(false);

    await user.click(screen.getByRole("button", { name: /Year 2/ }));
    expect(await screen.findByText("Riya Sharma")).toBeInTheDocument();
    expect(fetchWithAuth).toHaveBeenCalledWith("/admin/students?page=1&limit=20&year=2");
  });

  it("refetches whatever is currently shown when refreshKey changes (after a moderation action)", async () => {
    mockEndpoints({
      studentsList: { success: true, students: studentRows, total: 2, hasMore: false },
    });
    const { rerender } = render(
      <StudentsTab refreshKey={0} onView={noop} onBan={noop} onUnban={noop} onDelete={noop} />
    );
    await screen.findByText("Ishaan Kapoor");
    fetchWithAuth.mockClear();

    rerender(<StudentsTab refreshKey={1} onView={noop} onBan={noop} onUnban={noop} onDelete={noop} />);

    await waitFor(() =>
      expect(fetchWithAuth).toHaveBeenCalledWith("/admin/students?page=1&limit=20")
    );
  });
});

// ── Faculty detail modal ──────────────────────────────────────────

describe("FacultyDetailModal", () => {
  it("fetches /admin/faculty/:id and shows the all-time postings/applications/employee ID/office", async () => {
    mockEndpoints({
      facultyDetail: {
        success: true,
        faculty: {
          _id: "f1",
          name: "Prof. Arjun Nair",
          department: "Computer Science",
          accountStatus: "Active",
          employeeId: "FAC-2014",
          office: "Block A, Room 214",
          opportunitiesPosted: 3,
          applicationsReceived: 127,
        },
      },
    });
    render(<FacultyDetailModal facultyId="f1" onClose={noop} />);

    await waitFor(() =>
      expect(fetchWithAuth).toHaveBeenCalledWith("/admin/faculty/f1")
    );
    expect(await screen.findByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByText("127")).toBeInTheDocument();
    expect(screen.getByText("FAC-2014")).toBeInTheDocument();
    expect(screen.getByText("Block A, Room 214")).toBeInTheDocument();
    // The modal's own header carries the name — not duplicated in the body.
    expect(screen.getAllByText("Prof. Arjun Nair")).toHaveLength(1);
  });

  it("shows an unavailable state when the fetch fails or the faculty member isn't found", async () => {
    mockEndpoints({ facultyDetail: { success: true, faculty: null } });
    render(<FacultyDetailModal facultyId="ghost" onClose={noop} />);
    expect(await screen.findByText("Profile unavailable.")).toBeInTheDocument();
  });

  it("calls onClose when the modal's close button is clicked", async () => {
    mockEndpoints({
      facultyDetail: {
        success: true,
        faculty: {
          _id: "f1",
          name: "Prof. Arjun Nair",
          department: "Computer Science",
          accountStatus: "Active",
          employeeId: "FAC-2014",
          office: "Block A, Room 214",
          opportunitiesPosted: 3,
          applicationsReceived: 127,
        },
      },
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FacultyDetailModal facultyId="f1" onClose={onClose} />);
    await screen.findByText("Computer Science");

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onClose).toHaveBeenCalled();
  });
});
