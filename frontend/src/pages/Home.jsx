import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import "./Home.css";

import Navbar from "./Navbar";
import Avatar from "../components/Avatar";
import { IconSearch, IconClock } from "../components/Icons";
import { BRANCH_OPTIONS, YEAR_OPTIONS } from "../constants/profileOptions";

import { fetchPublic } from "../utils/api";


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

  const navigate = useNavigate();

  const currentUser = JSON.parse(
    localStorage.getItem("currentUser") || "null"
  );

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    const load = async () => {
      const data = await fetchPublic("/opportunities");
      if (Array.isArray(data)) setOpportunities(data);
    };
    load();
  }, []);

  const filteredOpportunities = opportunities.filter((item) => {
    const matchesSearch = item.title
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || item.category === selectedCategory;
    const matchesBranch =
      selectedBranch === "All" ||
      item.eligibleBranches?.includes("All") ||
      item.eligibleBranches?.includes(selectedBranch);
    const matchesYear =
      selectedYear === "All" ||
      item.eligibleYears?.includes("All") ||
      item.eligibleYears?.includes(selectedYear);
    return matchesSearch && matchesCategory && matchesBranch && matchesYear;
  });

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
              {filteredOpportunities.length}{" "}
              {filteredOpportunities.length === 1
                ? "opportunity"
                : "opportunities"}
            </span>
          </div>

          {/* GRID */}
          <div className="opportunities-grid">
            {filteredOpportunities.length === 0 ? (
              <div className="no-results">
                <h3>No opportunities found</h3>
                <p>Try changing the filters or search terms.</p>
              </div>
            ) : (
              filteredOpportunities.map((item) => (
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
                    <span className="oc-cta">View details →</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Home;
