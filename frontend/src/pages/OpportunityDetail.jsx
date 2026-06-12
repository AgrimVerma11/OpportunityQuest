import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { fetchPublic, BACKEND_URL } from "../utils/api";

import Navbar from "./Navbar";
import { IconFile } from "../components/Icons";

import "./OpportunityDetail.css";

function OpportunityDetail() {

  const { id } = useParams();

  const [opportunity, setOpportunity] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {

    const loadOpportunity =
      async () => {

        try {

          const response =
            await fetchPublic(
              `/opportunities/${id}`
            );

          if (
            response.success
          ) {

            setOpportunity(
              response.opportunity
            );

          }

        } catch (error) {

          console.error(error);

        } finally {

          setLoading(false);

        }
      };

    loadOpportunity();

  }, [id]);

  if (loading) {

    return (
      <>
        <Navbar />
        <p className="loading">
          Loading opportunity...
        </p>
      </>
    );
  }

  if (!opportunity) {

    return (
      <>
        <Navbar />
        <p className="loading">
          Opportunity not found.
        </p>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="detail-container">

        <div className="detail-card">

          <div className="detail-header">

            <h1 className="detail-title">
              {opportunity.title}
            </h1>

            <p className="detail-description">
              {opportunity.description}
            </p>

          </div>

          <div className="detail-grid">

            <div className="detail-box">

              <p className="detail-label">
                Category
              </p>

              <p className="detail-value">
                {opportunity.category}
              </p>

            </div>

            <div className="detail-box">

              <p className="detail-label">
                Posted By
              </p>

              <p className="detail-value">
                {opportunity.postedBy?.name}
              </p>

            </div>

            <div className="detail-box">

              <p className="detail-label">
                Department
              </p>

              <p className="detail-value">
                {
                  opportunity.postedBy
                    ?.department ||
                  "Not specified"
                }
              </p>

            </div>

            <div className="detail-box">

              <p className="detail-label">
                Eligible Branches
              </p>

              <p className="detail-value">
                {opportunity
                  .eligibleBranches
                  ?.join(", ")}
              </p>

            </div>

            <div className="detail-box">

              <p className="detail-label">
                Eligible Years
              </p>

              <p className="detail-value">
                {opportunity
                  .eligibleYears
                  ?.join(", ")}
              </p>

            </div>

            <div className="detail-box">

              <p className="detail-label">
                Eligible Gender
              </p>

              <p className="detail-value">
                {
                  opportunity.eligibleGender
                }
              </p>

            </div>

            <div className="detail-box">

              <p className="detail-label">
                Contact Email
              </p>

              <p className="detail-value">
                {
                  opportunity.contactEmail
                }
              </p>

            </div>

            <div className="detail-box">

              <p className="detail-label">
                Deadline
              </p>

              <p className="detail-value">
                {new Date(
                  opportunity.deadline
                ).toLocaleDateString()}
              </p>

            </div>

          </div>

          {opportunity.tags?.length > 0 && (
            <>
              <h3 className="tags-title">Related Tags</h3>
              <div className="tags-container">
                {opportunity.tags.map((tag, index) => (
                  <span className="tag" key={index}>
                    {tag}
                  </span>
                ))}
              </div>
            </>
          )}

          {opportunity.attachments?.length > 0 && (
            <>
              <h3 className="tags-title">Attachments</h3>
              <div className="attachments-list">
                {opportunity.attachments.map((att) => (
                  <a
                    key={att._id}
                    href={`${BACKEND_URL}${att.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="detail-attachment-link"
                  >
                    <IconFile /> {att.originalName}
                  </a>
                ))}
              </div>
            </>
          )}

          {opportunity.deadlineHistory?.length > 0 && (
            <>
              <h3 className="tags-title">Deadline History</h3>
              <ul className="deadline-history-list">
                {opportunity.deadlineHistory.map((entry, i) => (
                  <li key={i} className="deadline-history-item">
                    Changed on{" "}
                    {new Date(entry.extendedAt).toLocaleDateString()} — previous
                    deadline was{" "}
                    {new Date(entry.previousDeadline).toLocaleDateString()}
                    {entry.reason && ` (${entry.reason})`}
                  </li>
                ))}
              </ul>
            </>
          )}

        </div>

      </div>
    </>
  );
}

export default OpportunityDetail;