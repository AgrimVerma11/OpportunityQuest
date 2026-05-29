import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "./Navbar";
import "./Faculty.css";

import { fetchWithAuth } from "../utils/api";

function Faculty() {

  const navigate = useNavigate();

  const [loading, setLoading] =
    useState(true);

  const [opportunities, setOpportunities] =
    useState([]);

  useEffect(() => {

    const user = JSON.parse(
      localStorage.getItem("currentUser")
    );

    if (!user || user.role !== "Faculty") {

      navigate("/home");

      return;
    }

    loadMyOpportunities();

  }, []);

  const loadMyOpportunities =
    async () => {

      try {

        const data =
          await fetchWithAuth(
            "/opportunities/my-opportunities"
          );

        if (data.success) {

          setOpportunities(
            data.opportunities
          );
        }

      } catch (error) {

        console.error(error);

      } finally {

        setLoading(false);
      }
    };

  const totalCount =
    opportunities.length;

  const activeCount =
    opportunities.filter(
      (item) =>
        item.status === "Active"
    ).length;

  const closedCount =
    opportunities.filter(
      (item) =>
        item.status === "Closed"
    ).length;

  const expiredCount =
    opportunities.filter(
      (item) =>
        item.status === "Expired"
    ).length;

  return (
    <>
      <Navbar />

      <div className="faculty-container">

        <div className="faculty-inner">

          <div className="faculty-header">

            <div>

              <h1 className="faculty-title">
                Faculty Corner
              </h1>

              <p className="faculty-subtitle">
                Manage opportunities,
                collaborations and
                student engagement.
              </p>

            </div>

            <button
              className="create-opportunity-btn"
              onClick={() =>
                navigate(
                  "/create-opportunity"
                )
              }
            >
              + Create Opportunity
            </button>

          </div>

          {!loading && (
            <div className="stats-grid">

              <div className="stat-card">
                <h3>{totalCount}</h3>
                <p>Total Opportunities</p>
              </div>

              <div className="stat-card">
                <h3>{activeCount}</h3>
                <p>Active</p>
              </div>

              <div className="stat-card">
                <h3>{closedCount}</h3>
                <p>Closed</p>
              </div>

              <div className="stat-card">
                <h3>{expiredCount}</h3>
                <p>Expired</p>
              </div>

            </div>
          )}

          <div className="coming-soon-banner">

            <div>
              <strong>
                Faculty Profile
              </strong>
              <p>
                Profile management,
                document uploads and
                applicant tracking will
                be introduced in future
                releases.
              </p>
            </div>

          </div>

          <h2 className="section-title">
            My Opportunities
          </h2>

          {loading ? (

            <p>Loading...</p>

          ) : opportunities.length === 0 ? (

            <div className="empty-state">

              <h2>
                Ready to create your
                first opportunity?
              </h2>

              <p>
                Share internships,
                research projects and
                collaborations with
                students across campus.
              </p>

              <button
                className="create-opportunity-btn"
                onClick={() =>
                  navigate(
                    "/create-opportunity"
                  )
                }
              >
                Create Opportunity
              </button>

            </div>

          ) : (

            <div className="opportunities-grid">

              {opportunities.map(
                (item) => (

                  <div
                    key={item._id}
                    className="faculty-card"
                  >

                    <h3>
                      {item.title}
                    </h3>

                    <div className="faculty-meta">

                      <span className="meta-pill">
                        {item.category}
                      </span>

                      <span className="meta-pill">
                        {item.status}
                      </span>

                    </div>

                    <p>
                      <strong>
                        Deadline:
                      </strong>{" "}
                      {new Date(
                        item.deadline
                      ).toLocaleDateString()}
                    </p>

                    <p>
                      <strong>
                        Eligible Branches:
                      </strong>{" "}
                      {item.eligibleBranches?.join(", ")}
                    </p>

                    <p>
                      <strong>
                        Eligible Years:
                      </strong>{" "}
                      {item.eligibleYears?.join(", ")}
                    </p>

                    <p>
                      <strong>
                        Created:
                      </strong>{" "}
                      {new Date(
                        item.createdAt
                      ).toLocaleDateString()}
                    </p>

                    <div className="card-actions">

                      <button
                        className="view-btn"
                        onClick={() =>
                          navigate(
                            `/opportunity/${item._id}`
                          )
                        }
                      >
                        View
                      </button>

                    </div>

                  </div>
                )
              )}

            </div>

          )}

        </div>

      </div>
    </>
  );
}

export default Faculty;