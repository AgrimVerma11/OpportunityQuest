import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import "./Home.css";

import Navbar from "./Navbar";
import Avatar from "../components/Avatar";
import { IconSearch, IconClock } from "../components/Icons";
import { BRANCH_OPTIONS, YEAR_OPTIONS } from "../constants/profileOptions";

import { fetchWithAuth } from "../utils/api";
import { useAuth } from "../context/AuthContext";


// Days remaining until a deadline (negative if past). Drives the urgency chip.
function deadlineInfo(deadline) {
  if (!deadline) return null;
  const days = Math.ceil(
    (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (days < 0) return { label: "Closed", tone: "past" };
  if (days === 0) return { label: "Last day", tone: "urgent" };
  if (days === 1) return { label: "1 day left", tone: "urgent" };
  if (days <= 5) return { label: `${days} days left`, tone: "soon" };
  return { label: `${days} days left`, tone: "normal" };
}

function DeadlineChip({ deadline }) {
  const info = deadlineInfo(deadline);
  if (!info) return null;
  return (
    <span className={`deadline-chip ${info.tone}`}>
      <IconClock /> {info.label}
    </span>
  );
}

// Compact eligibility summary: "All", or first few values with a "+N" overflow.
function summarize(list, max = 3) {
  if (!list || list.length === 0) return "—";
  if (list.includes("All")) return "All";
  if (list.length <= max) return list.join(", ");
  return `${list.slice(0, max).join(", ")} +${list.length - max}`;
}


function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [selectedYear, setSelectedYear] = useState("All");

  const [opportunities, setOpportunities] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const buildQuery = (pageNum) => {
    const params = new URLSearchParams({ page: String(pageNum), limit: "12" });
    if (searchTerm.trim()) params.set("search", searchTerm.trim());
    if (selectedCategory !== "All") params.set("category", selectedCategory);
    if (selectedBranch !== "All") params.set("branch", selectedBranch);
    if (selectedYear !== "All") params.set("year", selectedYear);
    return params.toString();
  };

  const loadPage = async (pageNum, append) => {
    const data = await fetchWithAuth(`/opportunities?${buildQuery(pageNum)}`);
    if (!data?.success || !Array.isArray(data.opportunities)) {
      throw new Error(data?.message || "Unexpected response from the server.");
    }
    setOpportunities((prev) =>
      append ? [...prev, ...data.opportunities] : data.opportunities
    );
    // Tolerate a response without paging metadata rather than crash.
    setTotal(data.pagination?.total ?? data.opportunities.length);
    setHasMore(Boolean(data.pagination?.hasMore));
    setPage(pageNum);
  };

  // Any filter or search change resets to the first page. The search is
  // debounced so typing does not fire a request on every keystroke. Loading is
  // always cleared, so a failed request can never leave the feed spinning.
  useEffect(() => {
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        await loadPage(1, false);
      } catch (err) {
        console.error(err);
        setError("Couldn't load opportunities. Please try again in a moment.");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedCategory, selectedBranch, selectedYear]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      await loadPage(page + 1, true);
    } catch (err) {
      console.error(err);
      setError("Couldn't load more opportunities.");
    } finally {
      setLoadingMore(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("All");
    setSelectedBranch("All");
    setSelectedYear("All");
  };

  return (
    <>
      <Navbar />

      <div className="home-container">
        <div className="home-inner">

          {/* HEADER */}
          <div className="top-bar">
            <div>
              <h1 className="home-title">
                Welcome back,{" "}
                {currentUser?.prefix ? `${currentUser.prefix} ` : ""}
                {currentUser?.name}
              </h1>
              <p className="home-subtitle">
                {currentUser?.role === "Faculty"
                  ? "Manage opportunities, collaborations and projects across campus."
                  : "Discover internships, research opportunities, faculty projects and paid gigs."}
              </p>
            </div>
          </div>

          {/* FILTERS */}
          <div className="filter-wrapper">
            <div className="search-box">
              <IconSearch className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search opportunities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              <option value="Internship">Internship</option>
              <option value="Research">Research</option>
              <option value="Paid Gig">Paid Gig</option>
              <option value="Faculty Project">Faculty Project</option>
            </select>

            <select
              className="category-select"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="All">All Branches</option>
              {BRANCH_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              className="category-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="All">All Years</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={String(y)}>
                  {y === 1 ? "1st" : y === 2 ? "2nd" : y === 3 ? "3rd" : "4th"}{" "}
                  Year
                </option>
              ))}
            </select>

            <button className="clear-btn" onClick={clearFilters}>
              Clear
            </button>
          </div>

          {/* SECTION HEADER */}
          <div className="explore-header">
            <h2 className="section-title">Explore Opportunities</h2>
            <span className="result-count">
              {total} {total === 1 ? "opportunity" : "opportunities"}
            </span>
          </div>

          {/* RESULTS */}
          {loading ? (
            <div className="home-loading">
              <div className="home-spinner" />
              <p className="home-loading-text">Loading opportunities…</p>
            </div>
          ) : error ? (
            <div className="opportunities-grid">
              <div className="no-results">
                <h3>Something went wrong</h3>
                <p>{error}</p>
              </div>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="opportunities-grid">
              <div className="no-results">
                <h3>No opportunities found</h3>
                <p>Try changing the filters or search terms.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="opportunities-grid">
                {opportunities.map((item) => (
                  <div
                    className="opportunity-card"
                    key={item._id}
                    onClick={() => navigate(`/opportunity/${item._id}`)}
                  >
                    <div className="oc-header">
                      <span
                        className={`badge ${item.category?.replace(" ", "-")}`}
                      >
                        {item.category}
                      </span>
                      <DeadlineChip deadline={item.deadline} />
                    </div>

                    <h3 className="oc-title">{item.title}</h3>

                    <div className="oc-faculty">
                      <Avatar
                        name={item.postedBy?.name}
                        image={item.postedBy?.profileImage}
                        size={28}
                      />
                      <span className="oc-faculty-name">
                        {item.postedBy?.prefix
                          ? `${item.postedBy.prefix} `
                          : ""}
                        {item.postedBy?.name || "Faculty"}
                      </span>
                      {item.postedBy?.department && (
                        <span className="oc-faculty-dept">
                          · {item.postedBy.department}
                        </span>
                      )}
                    </div>

                    <p className="oc-desc">{item.description}</p>

                    {item.tags?.filter((t) => t.trim() !== "").length > 0 && (
                      <div className="oc-tags">
                        {item.tags
                          .filter((tag) => tag.trim() !== "")
                          .slice(0, 3)
                          .map((tag, index) => (
                            <span key={index} className="oc-tag">
                              {tag}
                            </span>
                          ))}
                      </div>
                    )}

                    <div className="oc-footer">
                      <div className="oc-eligibility">
                        <span>
                          <span className="oc-elig-label">Branches</span>{" "}
                          {summarize(item.eligibleBranches)}
                        </span>
                        <span>
                          <span className="oc-elig-label">Years</span>{" "}
                          {summarize(item.eligibleYears)}
                        </span>
                      </div>
                      <span className="oc-cta">View details →</span>
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: "var(--space-6)",
                  }}
                >
                  <button
                    className="btn btn-secondary"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default Home;
