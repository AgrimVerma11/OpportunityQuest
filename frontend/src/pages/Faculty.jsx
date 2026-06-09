import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "./Navbar";
import "./Faculty.css";

import {
  fetchWithAuth,
  patchWithAuth,
  deleteWithAuth,
} from "../utils/api";


// Defined at module scope so React doesn't recreate it on every render

function getDisplayStatus(item) {
  const deadline = new Date(item.deadline);
  const today = new Date();
  if (deadline < today && item.status === "Active") return "Expired";
  return item.status;
}

function OpportunityCard({
  item,
  onView,
  onEdit,
  onExtend,
  onArchive,
  onDelete,
  showExtend,
  showArchive,
}) {
  const displayStatus = getDisplayStatus(item);

  return (
    <div className="faculty-card">
      <h3>{item.title}</h3>

      <div className="faculty-meta">
        <span className="meta-pill">{item.category}</span>
        <span className={`status-pill ${displayStatus}`}>{displayStatus}</span>
      </div>

      <p>
        <strong>Deadline:</strong>{" "}
        {new Date(item.deadline).toLocaleDateString()}
      </p>
      <p>
        <strong>Created:</strong>{" "}
        {new Date(item.createdAt).toLocaleDateString()}
      </p>

      {item.deadlineHistory?.length > 0 && (
        <p className="deadline-extended-note">
          🔁 Deadline extended {item.deadlineHistory.length} time
          {item.deadlineHistory.length > 1 ? "s" : ""}
        </p>
      )}

      {item.attachments?.length > 0 && (
        <p className="attachment-note">
          📎 {item.attachments.length} attachment
          {item.attachments.length > 1 ? "s" : ""}
        </p>
      )}

      <div className="card-actions">
        <button className="view-btn" onClick={() => onView(item._id)}>
          View
        </button>

        <button className="secondary-btn" onClick={() => onEdit(item._id)}>
          Edit
        </button>

        {showExtend && (
          <button
            className="secondary-btn"
            onClick={() => onExtend(item._id, item.deadline)}
          >
            Extend Deadline
          </button>
        )}

        {showArchive && (
          <button
            className="secondary-btn"
            onClick={() => onArchive(item._id)}
          >
            Archive
          </button>
        )}

        <button className="delete-btn" onClick={() => onDelete(item._id)}>
          Delete
        </button>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────

function Faculty() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState([]);
  const [profile, setProfile] = useState(null);
  const [actionError, setActionError] = useState("");

  // Extend deadline modal
  const [extendModal, setExtendModal] = useState(null); // { id, currentDeadline }
  const [newDeadline, setNewDeadline] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const [extendError, setExtendError] = useState("");
  const [extending, setExtending] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("currentUser"));
    if (!user || user.role !== "Faculty") {
      navigate("/home");
      return;
    }
    loadMyOpportunities();
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await fetchWithAuth("/auth/profile");
      if (data.success) setProfile(data.profile);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMyOpportunities = async () => {
    try {
      const data = await fetchWithAuth("/opportunities/my-opportunities");
      if (data.success) setOpportunities(data.opportunities);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (id) => navigate(`/opportunity/${id}`);
  const handleEdit = (id) => navigate(`/edit-opportunity/${id}`);

  const handleArchive = async (id) => {
    if (!window.confirm("Archive this opportunity?")) return;
    setActionError("");
    try {
      const result = await patchWithAuth(`/opportunities/${id}/archive`);
      if (result.success) {
        loadMyOpportunities();
      } else {
        setActionError(result.message || "Failed to archive");
      }
    } catch (err) {
      console.error(err);
      setActionError("Something went wrong. Please try again.");
    }
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Delete this opportunity?\nIt will be removed from the student feed.\nThis action cannot be undone."
      )
    )
      return;
    setActionError("");
    try {
      const result = await deleteWithAuth(`/opportunities/${id}`);
      if (result.success) {
        loadMyOpportunities();
      } else {
        setActionError(result.message || "Failed to delete");
      }
    } catch (err) {
      console.error(err);
      setActionError("Something went wrong. Please try again.");
    }
  };

  const handleOpenExtend = (id, currentDeadline) => {
    setExtendModal({ id, currentDeadline });
    setNewDeadline("");
    setExtensionReason("");
    setExtendError("");
  };

  const handleExtendDeadline = async () => {
    if (!newDeadline) {
      setExtendError("Please select a new deadline.");
      return;
    }
    setExtending(true);
    setExtendError("");
    try {
      const result = await patchWithAuth(
        `/opportunities/${extendModal.id}/extend-deadline`,
        { newDeadline, reason: extensionReason }
      );
      if (result.success) {
        setExtendModal(null);
        setNewDeadline("");
        setExtensionReason("");
        loadMyOpportunities();
      } else {
        setExtendError(result.message || "Failed to extend deadline.");
      }
    } catch (err) {
      console.error(err);
      setExtendError("Something went wrong. Please try again.");
    } finally {
      setExtending(false);
    }
  };

  const closeExtendModal = () => {
    setExtendModal(null);
    setNewDeadline("");
    setExtensionReason("");
    setExtendError("");
  };

  const getMinExtendDate = () => {
    if (!extendModal) return "";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const afterCurrent = new Date(extendModal.currentDeadline);
    afterCurrent.setDate(afterCurrent.getDate() + 1);
    return new Date(Math.max(tomorrow, afterCurrent))
      .toISOString()
      .split("T")[0];
  };

  const activeOpportunities = opportunities.filter(
    (item) => getDisplayStatus(item) === "Active"
  );
  const expiredOpportunities = opportunities.filter(
    (item) => getDisplayStatus(item) === "Expired"
  );
  const archivedOpportunities = opportunities.filter(
    (item) => getDisplayStatus(item) === "Closed"
  );

  const totalCount = opportunities.length;
  const activeCount = activeOpportunities.length;
  const closedCount = archivedOpportunities.length;
  const expiredCount = expiredOpportunities.length;

  const completionFields = [
    profile?.bio,
    profile?.department,
    profile?.designation,
    profile?.interests,
    profile?.linkedinUrl,
  ];
  const completion = profile
    ? Math.round(
        (completionFields.filter((f) => f && f.toString().trim() !== "").length /
          completionFields.length) *
          100
      )
    : 0;

  const cardProps = {
    onView: handleView,
    onEdit: handleEdit,
    onArchive: handleArchive,
    onDelete: handleDelete,
    onExtend: handleOpenExtend,
  };

  return (
    <>
      <Navbar />

      <div className="faculty-container">
        <div className="faculty-inner">

          <div className="faculty-hero">
            <div>
              <p className="faculty-welcome">FACULTY DASHBOARD</p>
              <h1 className="faculty-title">
                Welcome back, {currentUser?.name}
              </h1>
              <div className="faculty-role-line">
                Faculty{profile?.department && ` • ${profile.department}`}
              </div>
              <p className="faculty-subtitle">
                Manage opportunities, research projects, internships and
                future student engagement from one central place.
              </p>
            </div>
            <button
              className="create-opportunity-btn"
              onClick={() => navigate("/create-opportunity")}
            >
              + Create Opportunity
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <h3>{totalCount}</h3>
              <p>Total</p>
            </div>
            <div className="stat-card">
              <h3>{activeCount}</h3>
              <p>Active</p>
            </div>
            <div className="stat-card">
              <h3>{closedCount}</h3>
              <p>Archived</p>
            </div>
            <div className="stat-card">
              <h3>{expiredCount}</h3>
              <p>Expired</p>
            </div>
          </div>

          <div className="faculty-profile-card">
            <div>
              <h2>Faculty Profile</h2>
              <p>
                Keep your profile updated so students can discover your
                expertise, interests and research work.
              </p>
            </div>
            <div>
              <div className="profile-completion">{completion}% Complete</div>
              <button
                className="secondary-btn"
                onClick={() => navigate("/profile")}
              >
                Manage Profile
              </button>
            </div>
          </div>

          {actionError && (
            <p style={{ color: "#ff4d4f", marginBottom: "1rem", fontWeight: 500 }}>
              {actionError}
            </p>
          )}

          {/* ACTIVE */}
          <h2 className="section-title">Active Opportunities</h2>

          {loading ? (
            <p>Loading...</p>
          ) : activeOpportunities.length === 0 ? (
            <div className="empty-state">
              <h2>No active opportunities</h2>
              <p>
                Create your first opportunity and start connecting with
                students.
              </p>
              <button
                className="create-opportunity-btn"
                onClick={() => navigate("/create-opportunity")}
              >
                Create Opportunity
              </button>
            </div>
          ) : (
            <div className="opportunities-grid">
              {activeOpportunities.map((item) => (
                <OpportunityCard
                  key={item._id}
                  item={item}
                  showExtend
                  showArchive
                  {...cardProps}
                />
              ))}
            </div>
          )}

          {/* EXPIRED */}
          {expiredOpportunities.length > 0 && (
            <>
              <h2 className="section-title">Expired Opportunities</h2>
              <div className="opportunities-grid">
                {expiredOpportunities.map((item) => (
                  <OpportunityCard
                    key={item._id}
                    item={item}
                    showExtend
                    showArchive
                    {...cardProps}
                  />
                ))}
              </div>
            </>
          )}

          {/* ARCHIVED */}
          {archivedOpportunities.length > 0 && (
            <>
              <h2 className="section-title">Archived Opportunities</h2>
              <div className="opportunities-grid">
                {archivedOpportunities.map((item) => (
                  <OpportunityCard
                    key={item._id}
                    item={item}
                    {...cardProps}
                  />
                ))}
              </div>
            </>
          )}

        </div>
      </div>

      {/* EXTEND DEADLINE MODAL */}
      {extendModal && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && closeExtendModal()
          }
        >
          <div className="modal-card">
            <h3>Extend Deadline</h3>
            <p className="modal-hint">
              New deadline must be later than the current one.
            </p>

            <label className="modal-label">New Deadline</label>
            <input
              type="date"
              className="modal-input"
              value={newDeadline}
              min={getMinExtendDate()}
              onChange={(e) => setNewDeadline(e.target.value)}
            />

            <label className="modal-label">Reason (optional)</label>
            <textarea
              className="modal-textarea"
              placeholder="e.g. Extended due to additional project scope"
              value={extensionReason}
              onChange={(e) => setExtensionReason(e.target.value)}
              maxLength={300}
              rows={3}
            />

            {extendError && (
              <p className="modal-error">{extendError}</p>
            )}

            <div className="modal-actions">
              <button className="secondary-btn" onClick={closeExtendModal}>
                Cancel
              </button>
              <button
                className="create-opportunity-btn"
                onClick={handleExtendDeadline}
                disabled={extending}
              >
                {extending ? "Extending..." : "Confirm Extension"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Faculty;
