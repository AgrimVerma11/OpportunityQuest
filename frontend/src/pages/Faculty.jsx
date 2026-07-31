import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "./Navbar";
import "./Faculty.css";

import PageHeader from "../components/PageHeader";
import CategoryTag from "../components/CategoryTag";
import StatusBadge from "../components/StatusBadge";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { useConfirm } from "../components/ConfirmProvider";
import { useToast } from "../components/ToastProvider";
import {
  IconHistory,
  IconPaperclip,
  IconPlus,
  IconFile,
  IconMore,
} from "../components/Icons";

import { fetchWithAuth, patchWithAuth, deleteWithAuth } from "../utils/api";
import { useAuth } from "../context/AuthContext";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Run a menu action and close the menu.
  const pick = (fn) => () => {
    setMenuOpen(false);
    fn();
  };
  const hasSecondary = showExtend || showArchive || showClose;

  return (
    <div className="card faculty-card">
      <div className="faculty-meta">
        <CategoryTag category={item.category} />
        <StatusBadge status={displayStatus} />
      </div>

      <h3 className="faculty-card-title">{item.title}</h3>

      <div className="faculty-card-facts">
        <div>
          <span className="faculty-fact-label">Deadline</span>
          {formatDate(item.deadline)}
        </div>
        <div>
          <span className="faculty-fact-label">Created</span>
          {formatDate(item.createdAt)}
        </div>
      </div>

      {(item.deadlineHistory?.length > 0 || item.attachments?.length > 0) && (
        <div className="faculty-card-notes">
          {item.deadlineHistory?.length > 0 && (
            <span className="faculty-note">
              <IconHistory /> Deadline changed {item.deadlineHistory.length}
              {item.deadlineHistory.length > 1 ? " times" : " time"}
            </span>
          )}
          {item.attachments?.length > 0 && (
            <span className="faculty-note">
              <IconPaperclip /> {item.attachments.length} attachment
              {item.attachments.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      <div className="faculty-card-actions">
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

        {showUnarchive && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onUnarchive(item._id, item.deadline)}
          >
            Reactivate
          </button>
        )}

        <div className="faculty-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="btn btn-secondary btn-sm faculty-menu-trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="More actions"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <IconMore />
          </button>

          {menuOpen && (
            <div className="faculty-menu" role="menu">
              {showExtend && (
                <button
                  type="button"
                  role="menuitem"
                  className="faculty-menu-item"
                  onClick={pick(() => onExtend(item._id, item.deadline))}
                >
                  Extend deadline
                </button>
              )}
              {showArchive && (
                <button
                  type="button"
                  role="menuitem"
                  className="faculty-menu-item"
                  onClick={pick(() => onArchive(item._id))}
                >
                  Archive
                </button>
              )}
              {showClose && (
                <button
                  type="button"
                  role="menuitem"
                  className="faculty-menu-item"
                  onClick={pick(() => onClose(item._id))}
                >
                  Close
                </button>
              )}
              {hasSecondary && <div className="faculty-menu-sep" />}
              <button
                type="button"
                role="menuitem"
                className="faculty-menu-item faculty-menu-danger"
                onClick={pick(() => onDelete(item._id))}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────

function Faculty() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState([]);
  const [profile, setProfile] = useState(null);

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

  const { user: currentUser } = useAuth();

  useEffect(() => {
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
    try {
      const result = await patchWithAuth(endpoint);
      if (result.success) {
        loadMyOpportunities();
      } else {
        toast.error(result.message || failMessage);
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
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
    try {
      const result = await deleteWithAuth(`/opportunities/${id}`);
      if (result.success) {
        loadMyOpportunities();
      } else {
        toast.error(result.message || "Failed to delete");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
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

  const stats = [
    { label: "Active", value: activeOpportunities.length, tone: "active" },
    { label: "Archived", value: archivedOpportunities.length, tone: "archived" },
    { label: "Expired", value: expiredOpportunities.length, tone: "expired" },
    { label: "Closed", value: closedOpportunities.length, tone: "closed" },
  ];

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
    <div className="faculty-grid">
      {items.map((item) => (
        <OpportunityCard key={item._id} item={item} {...flags} {...cardProps} />
      ))}
    </div>
  );

  return (
    <>
      <Navbar />

      <div className="faculty">
        <PageHeader
          title={`Welcome back, ${
            currentUser?.prefix ? `${currentUser.prefix} ` : ""
          }${currentUser?.name || ""}`}
          subtitle="Manage opportunities, research projects, internships and student engagement from one central place."
          action={
            <button
              className="btn btn-primary"
              onClick={() => navigate("/create-opportunity")}
            >
              <IconPlus /> Create opportunity
            </button>
          }
        />

        <div className="container faculty-body">
          {loading ? (
            <div className="faculty-status">
              <Spinner center label="Loading your dashboard" />
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="faculty-stats">
                {stats.map((s) => (
                  <div
                    className={`card faculty-stat faculty-stat-${s.tone}`}
                    key={s.label}
                  >
                    <span className="faculty-stat-value">{s.value}</span>
                    <span className="faculty-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Profile nudge: only when there is something worth completing */}
              {profile && completion < 100 && (
                <div className="faculty-profile">
                  <div className="faculty-profile-text">
                    <p className="faculty-profile-title">
                      Complete your profile
                    </p>
                    <p className="faculty-profile-desc">
                      Add your bio, department and interests so students can find
                      your work.
                    </p>
                  </div>
                  <div
                    className="faculty-progress-track"
                    role="progressbar"
                    aria-valuenow={completion}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Profile completion"
                  >
                    <div
                      className="faculty-progress-fill"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                  <span className="faculty-progress-value">{completion}%</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate("/profile")}
                  >
                    Manage profile
                  </button>
                </div>
              )}

              {/* Active */}
              <h2 className="faculty-section-title">Active opportunities</h2>
              {activeOpportunities.length === 0 ? (
                <EmptyState
                  icon={<IconFile />}
                  title="No active opportunities"
                  description="Create your first opportunity and start connecting with students."
                  action={
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate("/create-opportunity")}
                    >
                      <IconPlus /> Create opportunity
                    </button>
                  }
                />
              ) : (
                renderGrid(activeOpportunities, {
                  showArchive: true,
                  showClose: true,
                })
              )}

              {/* Expired */}
              {expiredOpportunities.length > 0 && (
                <>
                  <h2 className="faculty-section-title">
                    Expired opportunities
                  </h2>
                  {renderGrid(expiredOpportunities, {
                    showExtend: true,
                    showArchive: true,
                    showClose: true,
                  })}
                </>
              )}

              {/* Archived */}
              {archivedOpportunities.length > 0 && (
                <>
                  <h2 className="faculty-section-title">
                    Archived opportunities
                  </h2>
                  <p className="faculty-section-subtitle">
                    Paused while you review applicants. Reactivate to make live
                    again, or close once finalised.
                  </p>
                  {renderGrid(archivedOpportunities, {
                    showUnarchive: true,
                    showClose: true,
                  })}
                </>
              )}

              {/* Closed */}
              {closedOpportunities.length > 0 && (
                <>
                  <h2 className="faculty-section-title">Closed opportunities</h2>
                  {renderGrid(closedOpportunities, {})}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Extend deadline modal */}
      {extendModal && (
        <Modal
          open
          onClose={closeExtendModal}
          title="Extend deadline"
          size="sm"
          footer={
            <>
              <button className="btn btn-secondary" onClick={closeExtendModal}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleExtendDeadline}
                disabled={extending}
              >
                {extending ? "Extending…" : "Confirm extension"}
              </button>
            </>
          }
        >
          <p className="faculty-modal-hint">
            New deadline must be later than the current one (
            {formatDate(extendModal.currentDeadline)}).
          </p>

          <div className="faculty-modal-fields">
            <Field id="extend-deadline" label="New deadline" error={extendError}>
              <input
                type="date"
                value={newDeadline}
                min={getMinDate(extendModal.currentDeadline)}
                onChange={(e) => setNewDeadline(e.target.value)}
              />
            </Field>

            <Field id="extend-reason" label="Reason (optional)">
              <textarea
                placeholder="e.g. Extended due to additional project scope"
                value={extensionReason}
                onChange={(e) => setExtensionReason(e.target.value)}
                maxLength={300}
                rows={3}
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* Unarchive modal */}
      {unarchiveModal && (
        <Modal
          open
          onClose={closeUnarchiveModal}
          title="Reactivate opportunity"
          size="sm"
          footer={
            <>
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
            </>
          }
        >
          <p className="faculty-modal-hint">
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
                    " (already passed, set a new one)"}
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
            <Field id="unarchive-deadline" label="New deadline">
              <input
                type="date"
                value={unarchiveDeadline}
                min={getMinDate()}
                onChange={(e) => setUnarchiveDeadline(e.target.value)}
              />
            </Field>
          )}

          {unarchiveError && <p className="field-error">{unarchiveError}</p>}
        </Modal>
      )}
    </>
  );
}

export default Faculty;
