import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import "./Home.css";

import Navbar from "./Navbar";
import Avatar from "../components/Avatar";
import CategoryTag from "../components/CategoryTag";
import DeadlineChip from "../components/DeadlineChip";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { IconSearch, IconAlert, IconPlus, IconArrowRight } from "../components/Icons";
import { BRANCH_OPTIONS, YEAR_OPTIONS } from "../constants/profileOptions";

import { fetchWithAuth } from "../utils/api";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = ["All", "Internship", "Research", "Paid Gig", "Faculty Project"];
const YEAR_LABEL = { 1: "1st Year", 2: "2nd Year", 3: "3rd Year", 4: "4th Year" };

// Compact eligibility summary: "All", or first few values with a "+N" overflow.
function summarize(list, max = 3) {
  if (!list || list.length === 0) return "-";
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
  const [reloadKey, setReloadKey] = useState(0);

  const { user: currentUser } = useAuth();
  const isFaculty = currentUser?.role === "Faculty";
  const isStudent = currentUser?.role === "Student";
  // Faculty and coordinators can both post and manage opportunities.
  const canPost = isFaculty || currentUser?.role === "Coordinator";

  const hasFilters =
    searchTerm.trim() !== "" ||
    selectedCategory !== "All" ||
    selectedBranch !== "All" ||
    selectedYear !== "All";

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
  }, [searchTerm, selectedCategory, selectedBranch, selectedYear, reloadKey]);

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

      <div className="home">
        <PageHeader
          title={`Welcome back, ${
            currentUser?.prefix ? `${currentUser.prefix} ` : ""
          }${currentUser?.name || ""}`}
          subtitle={
            canPost
              ? "Post opportunities and manage collaborations and projects across campus."
              : "Discover internships, research opportunities, faculty projects and paid gigs, all in one place."
          }
          action={
            canPost ? (
              <Link to="/create-opportunity" className="btn btn-primary">
                <IconPlus /> Post an opportunity
              </Link>
            ) : isStudent ? (
              <Link to="/my-applications" className="btn btn-secondary">
                My applications
              </Link>
            ) : null
          }
        />

        <div className="container home-body">

          {/* Filter toolbar */}
          <div className="home-filters">
            <div
              className="home-chips"
              role="group"
              aria-label="Filter by category"
            >
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`home-chip${
                    selectedCategory === cat ? " active" : ""
                  }`}
                  aria-pressed={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat === "All" ? "All opportunities" : cat}
                </button>
              ))}
            </div>

            <div className="home-toolbar" role="search">
              <div className="home-search">
                <IconSearch className="home-search-icon" />
                <input
                  type="text"
                  className="field-control"
                  placeholder="Search by title, keyword or tag"
                  aria-label="Search opportunities"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className="field-control home-select"
                aria-label="Filter by branch"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="All">All branches</option>
                {BRANCH_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <select
                className="field-control home-select"
                aria-label="Filter by year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="All">All years</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={String(y)}>
                    {YEAR_LABEL[y]}
                  </option>
                ))}
              </select>

              {hasFilters && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={clearFilters}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Section header */}
          <div className="home-section-head">
            <h2 className="home-section-title">
              {selectedCategory === "All" ? "Explore opportunities" : selectedCategory}
            </h2>
            {!loading && !error && (
              <span className="home-count">
                {total} {total === 1 ? "result" : "results"}
              </span>
            )}
          </div>

          {/* Results */}
          {loading ? (
            <div className="home-status">
              <Spinner center label="Loading opportunities" />
            </div>
          ) : error ? (
            <EmptyState
              icon={<IconAlert />}
              title="Something went wrong"
              description={error}
              action={
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReloadKey((k) => k + 1)}
                >
                  Try again
                </button>
              }
            />
          ) : opportunities.length === 0 ? (
            <EmptyState
              icon={<IconSearch />}
              title="No opportunities found"
              description="Try a different category, or clear your filters to see everything."
              action={
                hasFilters && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                )
              }
            />
          ) : (
            <>
              <div className="opportunities-grid">
                {opportunities.map((item) => (
                  <Link
                    to={`/opportunity/${item._id}`}
                    className="card card-hover opportunity-card"
                    key={item._id}
                  >
                    <div className="oc-header">
                      <CategoryTag category={item.category} />
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
                        {item.postedBy?.prefix ? `${item.postedBy.prefix} ` : ""}
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
                      <span className="oc-cta">
                        View details <IconArrowRight className="oc-cta-icon" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {hasMore && (
                <div className="home-loadmore">
                  <button
                    type="button"
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
