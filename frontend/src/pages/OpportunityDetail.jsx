import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchPublic } from "../utils/api"; // ✅ FIXED
import Navbar from "./Navbar";
import "./OpportunityDetail.css";

function OpportunityDetail() {
  const { id } = useParams();
  const [opportunity, setOpportunity] = useState(null);

  useEffect(() => {
    const load = async () => {
      const data = await fetchPublic("/opportunities");
      const found = data.find((o) => o._id === id);
      setOpportunity(found);
    };

    load();
  }, [id]);

  if (!opportunity) return <p className="loading">Loading...</p>;

return (
  <>
    <Navbar />

    <div className="detail-container">
      <div className="detail-card">

        {/* HEADER */}
        <div className="detail-header">
          <h1 className="detail-title">
            {opportunity.title}
          </h1>

          <p className="detail-description">
            {opportunity.description}
          </p>
        </div>

        {/* INFO GRID */}
        <div className="detail-grid">

          <div className="detail-box">
            <p className="detail-label">Category</p>
            <p className="detail-value">
              {opportunity.category}
            </p>
          </div>

          <div className="detail-box">
            <p className="detail-label">Posted By</p>
            <p className="detail-value">
              {opportunity.postedBy?.name || "User"}
            </p>
          </div>

          <div className="detail-box">
            <p className="detail-label">Eligible Branches</p>
            <p className="detail-value">
              {opportunity.eligibleBranches?.join(", ")}
            </p>
          </div>

          <div className="detail-box">
            <p className="detail-label">Eligible Years</p>
            <p className="detail-value">
              {opportunity.eligibleYears?.join(", ")}
            </p>
          </div>

          <div className="detail-box">
            <p className="detail-label">Eligible Gender</p>
            <p className="detail-value">
              {opportunity.eligibleGender}
            </p>
          </div>

          <div className="detail-box">
            <p className="detail-label">Contact Email</p>
            <p className="detail-value">
              {opportunity.contactEmail}
            </p>
          </div>

        </div>

        {/* TAGS */}
        {opportunity.tags?.length > 0 && (
          <>
            <h3 className="tags-title">
              Related Tags
            </h3>

            <div className="tags-container">
              {opportunity.tags.map((tag, index) => (
                <span className="tag" key={index}>
                  #{tag}
                </span>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  </>
);
}

export default OpportunityDetail;