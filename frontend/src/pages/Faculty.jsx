import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "./Navbar";
import "./Faculty.css";

import { useConfirm } from "../components/ConfirmProvider";
import { IconHistory, IconPaperclip } from "../components/Icons";

import {
  fetchWithAuth,
  patchWithAuth,
  deleteWithAuth,
} from "../utils/api";


// Defined at module scope so React doesn't recreate it on every render.
// Archived/Closed are real persisted states; "Expired" is derived only for
// Active opportunities whose deadline has passed.
function getDisplayStatus(item) {
  if (item.status === "Active") {
    return new Date(item.deadline) < new Date() ? "Expired" : "Active";
  }
  return item.status;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}


function OpportunityCard({
  item,
  onView,
  onApplicants,
  onEdit,
  onExtend,
  onArchive,
  onUnarchive,
  onClose,
  onDelete,
  showExtend,
  showArchive,
  showUnarchive,
  showClose,
}) {
  const displayStatus = getDisplayStatus(item);

  return (
    <div className="faculty-card">
      <div className="faculty-meta">
        <span className="meta-pill">{item.category}</span>
        <span className={`status-pill ${displayStatus}`}>{displayStatus}</span>
      </div>

      <h3>{item.title}</h3>

      <div className="faculty-card-facts">
        <p>
          <strong>Deadline</strong> {formatDate(item.deadline)}
        </p>
        <p>
          <strong>Created</strong> {formatDate(item.createdAt)}
        </p>
      </div>

      {(item.deadlineHistory?.length > 0 || item.attachments?.length > 0) && (
        <div className="faculty-card-notes">
          {item.deadlineHistory?.length > 0 && (
            <span className="card-note">
              <IconHistory /> Deadline changed {item.deadlineHistory.length}
              {item.deadlineHistory.length > 1 ? " times" : " time"}
            </span>
          )}
          {item.attachments?.length > 0 && (
            <span className="card-note">
              <IconPaperclip /> {item.attachments.length} attachment
              {item.attachments.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      <div className="card-actions">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onView(item._id)}
        >
          View
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onApplicants(item._id)}
        >
          Applicants{item.applicationsCount ? ` · ${item.applicationsCount}` : ""}
        </button>

        {item.status !== "Closed" && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onEdit(item._id)}
          >
            Edit
          </button>
        )}

        {showExtend && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onExtend(item._id, item.deadline)}
          >
            Extend Deadline
          </button>
        )}

        {showArchive && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onArchive(item._id)}
          >
            Archive
          </button>
        )}

        {showUnarchive && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onUnarchive(item._id, item.deadline)}
          >
            Unarchive
          </button>
        )}

        {showClose && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onClose(item._id)}
          >
            Close
          </button>
        )}

        <button
          className="btn btn-danger-ghost btn-sm"
          onClick={() => onDelete(item._id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────

function Faculty() {
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState([]);
  const [profile, setProfile] = useState(null);
  const [actionError, setActionError] = useState("");

  // Extend-deadline modal
  const [extendModal, setExtendModal] = useState(null); // { id, currentDeadline }
  const [newDeadline, setNewDeadline] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const [extendError, setExtendError] = useState("");
  const [extending, setExtending] = useState(false);

  // Unarchive modal
  const [unarchiveModal, setUnarchiveModal] = useState(null); // { id, currentDeadline, deadlinePassed }
  const [unarchiveMode, setUnarchiveMode] = useState("keep"); // "keep" | "new"
  const [unarchiveDeadline, setUnarchiveDeadline] = useState("");
  const [unarchiveError, setUnarchiveError] = useState("");
  const [unarchiving, setUnarchiving] = useState(false);

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

  // Generic status-change helper for the confirm-then-PATCH actions.
  const runStatusAction = async (endpoint, confirmOptions, failMessage) => {
    if (confirmOptions && !(await confirm(confirmOptions))) return;
    setActionError("");
    try {
      const result = await patchWithAuth(endpoint);
      if (result.success) {
        loadMyOpportunities();
      } else {
        setActionError(result.message || failMessage);
      }
    } catch (err) {
      console.error(err);
      setActionError("Something went wrong. Please try again.");
    }
  };

  const handleArchive = (id) =>
    runStatusAction(
      `/opportunities/${id}/archive`,
      {
        title: "Archive this opportunity?",
        message:
          "It will be paused and hidden from students while you review applicants. You can reactivate it later.",
        confirmLabel: "Archive",
      },
      "Failed to archive"
    );

  const handleClose = (id) =>
    runStatusAction(
      `/opportunities/${id}/close`,
      {
        title: "Close this opportunity?",
        message: "This marks it as finalised. This action cannot be undone.",
        confirmLabel: "Close",
        tone: "danger",
      },
      "Failed to close"
    );

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: "Delete this opportunity?",
      message:
        "It will be removed from the student feed. This action cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
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

  // ── Extend deadline ──
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
        closeExtendModal();
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

  // ── Unarchive (reactivate) ──
  const handleOpenUnarchive = (id, currentDeadline) => {
    const deadlinePassed = new Date(currentDeadline) <= new Date();
    setUnarchiveModal({ id, currentDeadline, deadlinePassed });
    // If the old deadline has passed, the only valid path is a new one.
    setUnarchiveMode(deadlinePassed ? "new" : "keep");
    setUnarchiveDeadline("");
    setUnarchiveError("");
  };

  const handleUnarchive = async () => {
    if (unarchiveMode === "new" && !unarchiveDeadline) {
      setUnarchiveError("Please select a new deadline.");
      return;
    }
    setUnarchiving(true);
    setUnarchiveError("");
    try {
      const body =
        unarchiveMode === "new" ? { newDeadline: unarchiveDeadline } : {};
      const result = await patchWithAuth(
        `/opportunities/${unarchiveModal.id}/unarchive`,
        body
      );
      if (result.success) {
        closeUnarchiveModal();
        loadMyOpportunities();
      } else {
        setUnarchiveError(result.message || "Failed to reactivate.");
      }
    } catch (err) {
      console.error(err);
      setUnarchiveError("Something went wrong. Please try again.");
    } finally {
      setUnarchiving(false);
    }
  };

  const closeUnarchiveModal = () => {
    setUnarchiveModal(null);
    setUnarchiveMode("keep");
    setUnarchiveDeadline("");
    setUnarchiveError("");
  };

  const getMinDate = (afterDateStr) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const candidates = [tomorrow];
    if (afterDateStr) {
      const afterCurrent = new Date(afterDateStr);
      afterCurrent.setDate(afterCurrent.getDate() + 1);
      candidates.push(afterCurrent);
    }
    return new Date(Math.max(...candidates)).toISOString().split("T")[0];
  };

  // ── Grouping ──
  const activeOpportunities = opportunities.filter(
    (item) => getDisplayStatus(item) === "Active"
  );
  const expiredOpportunities = opportunities.filter(
    (item) => getDisplayStatus(item) === "Expired"
  );
  const archivedOpportunities = opportunities.filter(
    (item) => getDisplayStatus(item) === "Archived"
  );
  const closedOpportunities = opportunities.filter(
    (item) => getDisplayStatus(item) === "Closed"
  );

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
    onApplicants: (id) => navigate(`/opportunity/${id}/applicants`),
    onEdit: handleEdit,
    onArchive: handleArchive,
    onUnarchive: handleOpenUnarchive,
    onClose: handleClose,
    onDelete: handleDelete,
    onExtend: handleOpenExtend,
  };

  const renderGrid = (items, flags) => (
    <div className="opportunities-grid">
      {items.map((item) => (
        <OpportunityCard key={item._id} item={item} {...flags} {...cardProps} />
      ))}
    </div>
  );

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
                Faculty{profile?.department && ` · ${profile.department}`}
              </div>
              <p className="faculty-subtitle">
                Manage opportunities, research projects, internships and
                student engagement from one central place.
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/create-opportunity")}
            >
              + Create Opportunity
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <h3>{activeOpportunities.length}</h3>
              <p>Active</p>
            </div>
            <div className="stat-card">
              <h3>{archivedOpportunities.length}</h3>
              <p>Archived</p>
            </div>
            <div className="stat-card">
              <h3>{expiredOpportunities.length}</h3>
              <p>Expired</p>
            </div>
            <div className="stat-card">
              <h3>{closedOpportunities.length}</h3>
              <p>Closed</p>
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
            <div className="faculty-profile-aside">
              <div className="profile-completion">{completion}% Complete</div>
              <button
                className="btn btn-secondary"
                onClick={() => navigate("/profile")}
              >
                Manage Profile
              </button>
            </div>
          </div>

          {actionError && <div className="action-error-bar">{actionError}</div>}

          {/* ACTIVE */}
          <h2 className="section-title">Active Opportunities</h2>

          {loading ? (
            <p className="faculty-loading">Loading…</p>
          ) : activeOpportunities.length === 0 ? (
            <div className="empty-state">
              <h2>No active opportunities</h2>
              <p>
                Create your first opportunity and start connecting with
                students.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => navigate("/create-opportunity")}
              >
                Create Opportunity
              </button>
            </div>
          ) : (
            renderGrid(activeOpportunities, { showArchive: true, showClose: true })
          )}

          {/* EXPIRED */}
          {expiredOpportunities.length > 0 && (
            <>
              <h2 className="section-title">Expired Opportunities</h2>
              {renderGrid(expiredOpportunities, {
                showExtend: true,
                showArchive: true,
                showClose: true,
              })}
            </>
          )}

          {/* ARCHIVED */}
          {archivedOpportunities.length > 0 && (
            <>
              <h2 className="section-title">Archived Opportunities</h2>
              <p className="section-subtitle">
                Paused while you review applicants. Reactivate to make live again,
                or close once finalised.
              </p>
              {renderGrid(archivedOpportunities, {
                showUnarchive: true,
                showClose: true,
              })}
            </>
          )}

          {/* CLOSED */}
          {closedOpportunities.length > 0 && (
            <>
              <h2 className="section-title">Closed Opportunities</h2>
              {renderGrid(closedOpportunities, {})}
            </>
          )}

        </div>
      </div>

      {/* EXTEND DEADLINE MODAL */}
      {extendModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeExtendModal()}
        >
          <div className="modal-card">
            <h3>Extend Deadline</h3>
            <p className="modal-hint">
              New deadline must be later than the current one (
              {formatDate(extendModal.currentDeadline)}).
            </p>

            <label className="modal-label">New Deadline</label>
            <input
              type="date"
              className="modal-input"
              value={newDeadline}
              min={getMinDate(extendModal.currentDeadline)}
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

            {extendError && <p className="modal-error">{extendError}</p>}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeExtendModal}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleExtendDeadline}
                disabled={extending}
              >
                {extending ? "Extending…" : "Confirm Extension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNARCHIVE MODAL */}
      {unarchiveModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeUnarchiveModal()}
        >
          <div className="modal-card">
            <h3>Reactivate Opportunity</h3>
            <p className="modal-hint">
              Make this opportunity live for students again. Continue with the
              current deadline or set a new one.
            </p>

            <div className="unarchive-options">
              <label
                className={`unarchive-option ${
                  unarchiveModal.deadlinePassed ? "is-disabled" : ""
                }`}
              >
                <input
                  type="radio"
                  name="unarchiveMode"
                  value="keep"
                  checked={unarchiveMode === "keep"}
                  disabled={unarchiveModal.deadlinePassed}
                  onChange={() => setUnarchiveMode("keep")}
                />
                <span>
                  <strong>Keep current deadline</strong>
                  <small>
                    {formatDate(unarchiveModal.currentDeadline)}
                    {unarchiveModal.deadlinePassed &&
                      " — already passed, set a new one"}
                  </small>
                </span>
              </label>

              <label className="unarchive-option">
                <input
                  type="radio"
                  name="unarchiveMode"
                  value="new"
                  checked={unarchiveMode === "new"}
                  onChange={() => setUnarchiveMode("new")}
                />
                <span>
                  <strong>Set a new deadline</strong>
                  <small>Choose a future date below</small>
                </span>
              </label>
            </div>

            {unarchiveMode === "new" && (
              <input
                type="date"
                className="modal-input"
                value={unarchiveDeadline}
                min={getMinDate()}
                onChange={(e) => setUnarchiveDeadline(e.target.value)}
              />
            )}

            {unarchiveError && <p className="modal-error">{unarchiveError}</p>}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={closeUnarchiveModal}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUnarchive}
                disabled={unarchiving}
              >
                {unarchiving ? "Reactivating…" : "Reactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Faculty;
