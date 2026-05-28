import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import Navbar from "./Navbar";
import { fetchPublic } from "../utils/api";

function Home() {

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const [selectedBranch, setSelectedBranch] =
    useState("All");

  const [selectedYear, setSelectedYear] =
    useState("All");

  const [currentUser, setCurrentUser] =
    useState(null);

  const [opportunities, setOpportunities] =
    useState([]);

  const navigate = useNavigate();

  // =========================
  // AUTH
  // =========================

  useEffect(() => {

    const token =
      localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    const storedUser = JSON.parse(
      localStorage.getItem("currentUser")
    );

    if (storedUser) {
      setCurrentUser(storedUser);
    }

  }, [navigate]);

  // =========================
  // FETCH OPPORTUNITIES
  // =========================

  useEffect(() => {

    const loadOpportunities = async () => {

      const data = await fetchPublic(
        "/opportunities"
      );

      if (Array.isArray(data)) {
        setOpportunities(data);
      }
    };

    loadOpportunities();

  }, []);

  // =========================
  // FILTERS
  // =========================

  const filteredOpportunities =
    opportunities.filter((item) => {

      const matchesSearch =
        item.title
          ?.toLowerCase()
          .includes(
            searchTerm.toLowerCase()
          );

      const matchesCategory =
        selectedCategory === "All" ||
        item.category === selectedCategory;

      const matchesBranch =
        selectedBranch === "All" ||
        item.eligibleBranches?.includes(
          "All"
        ) ||
        item.eligibleBranches?.includes(
          selectedBranch
        );

      const matchesYear =
        selectedYear === "All" ||
        item.eligibleYears?.includes(
          "All"
        ) ||
        item.eligibleYears?.includes(
          selectedYear
        );

      return (
        matchesSearch &&
        matchesCategory &&
        matchesBranch &&
        matchesYear
      );
    });

  return (
    <>
      <Navbar />

      <div className="home-container">

        <div className="home-inner">

          {/* HEADER */}

          <div className="top-bar">

            <div>

              <h1 className="home-title">
                Opportunity Quest
              </h1>

              <p className="home-subtitle">
                Discover internships,
                research opportunities,
                collaborations and gigs.
              </p>

              {currentUser && (

                <div className="user-header">

                  <span className="hello-text">
                    Hello, {currentUser.name}
                  </span>

                  <span
                    className={`role-badge ${currentUser.role}`}
                  >
                    {currentUser.role}
                  </span>

                </div>

              )}

            </div>

            <div className="top-actions">

              <button
                className="create-btn"
                onClick={() =>
                  navigate("/create")
                }
              >
                + Post Opportunity
              </button>

            </div>

          </div>

          {/* FILTERS */}

          <div className="filter-wrapper">

            <input
              type="text"
              className="search-input"
              placeholder="Search opportunities..."
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(
                  e.target.value
                )
              }
            />

            {/* CATEGORY */}

            <select
              className="category-select"
              value={selectedCategory}
              onChange={(e) =>
                setSelectedCategory(
                  e.target.value
                )
              }
            >

              <option value="All">
                All Categories
              </option>

              <option value="Internship">
                Internship
              </option>

              <option value="Research">
                Research
              </option>

              <option value="Paid Gig">
                Paid Gig
              </option>

              <option value="Faculty Project">
                Faculty Project
              </option>

            </select>

            {/* BRANCH */}

            <select
              className="category-select"
              value={selectedBranch}
              onChange={(e) =>
                setSelectedBranch(
                  e.target.value
                )
              }
            >

              <option value="All">
                All Branches
              </option>

              <option value="COE">
                COE
              </option>

              <option value="ENC">
                ENC
              </option>

              <option value="ECE">
                ECE
              </option>

              <option value="RAI">
                RAI
              </option>

              <option value="COBS">
                COBS
              </option>

              <option value="EEC">
                EEC
              </option>

            </select>

            {/* YEAR */}

            <select
              className="category-select"
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(
                  e.target.value
                )
              }
            >

              <option value="All">
                All Years
              </option>

              <option value="1">
                1st Year
              </option>

              <option value="2">
                2nd Year
              </option>

              <option value="3">
                3rd Year
              </option>

              <option value="4">
                4th Year
              </option>

            </select>

            {/* CLEAR */}

            <button
              className="clear-btn"
              onClick={() => {

                setSearchTerm("");

                setSelectedCategory(
                  "All"
                );

                setSelectedBranch(
                  "All"
                );

                setSelectedYear(
                  "All"
                );

              }}
            >
              Clear
            </button>

          </div>

          {/* TITLE */}

          <h2 className="section-title">
            Explore Opportunities
          </h2>

          {/* OPPORTUNITIES */}

          <div className="opportunities-grid">

            {filteredOpportunities.length === 0 ? (

              <p className="no-results">
                No opportunities found.
              </p>

            ) : (

              filteredOpportunities.map((item) => (

                <div
                  className="opportunity-card"
                  key={item._id}
                  onClick={() =>
                    navigate(
                      `/opportunity/${item._id}`
                    )
                  }
                >

                  {/* TOP */}

                  <div className="card-top">

                    <h3 className="opportunity-title">
                      {item.title}
                    </h3>

                    <span
                      className={`badge ${item.category?.replace(
                        " ",
                        "-"
                      )}`}
                    >
                      {item.category}
                    </span>

                  </div>

                  {/* DESCRIPTION */}

                  <p className="card-description">

                    {item.description?.length > 140
                      ? item.description.slice(
                          0,
                          140
                        ) + "..."
                      : item.description}

                  </p>

                  {/* TAGS */}

                  {item.tags?.length > 0 && (

                    <div className="tags-row">

                      {item.tags
                        .filter(
                          (tag) =>
                            tag.trim() !== ""
                        )
                        .map((tag, index) => (

                          <span
                            key={index}
                            className="tag-pill"
                          >
                            {tag}
                          </span>

                        ))}

                    </div>

                  )}

                  {/* ELIGIBILITY */}

                  <div className="eligibility-row">

                    <div className="eligibility-box">

                      <span className="footer-label">
                        Branches
                      </span>

                      <p>
                        {item.eligibleBranches?.join(
                          ", "
                        )}
                      </p>

                    </div>

                    <div className="eligibility-box">

                      <span className="footer-label">
                        Years
                      </span>

                      <p>
                        {item.eligibleYears?.join(
                          ", "
                        )}
                      </p>

                    </div>

                  </div>

                  {/* FOOTER */}

                  <div className="card-footer">

                    <div className="deadline-box">

                      <span className="footer-label">
                        Deadline
                      </span>

                      <span className="deadline-text">

                        {item.deadline
                          ? new Date(
                              item.deadline
                            ).toLocaleDateString()
                          : "No deadline"}

                      </span>

                    </div>

                    <div className="posted-box">

                      <span className="footer-label">
                        Posted by
                      </span>

                      <span
                        className={`role-badge ${item.postedBy?.role}`}
                      >
                        {item.postedBy?.role ||
                          "User"}
                      </span>

                    </div>

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