import { useEffect, useState } from "react";

import Navbar from "./Navbar";
import Avatar from "../components/Avatar";
import { useConfirm } from "../components/ConfirmProvider";
import { fetchWithAuth, patchWithAuth } from "../utils/api";

import "./Approvals.css";

function timeAgo(dateString) {
  if (!dateString) return "recently";
  const days = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "a week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  return new Date(dateString).toLocaleDateString();
}

function Approvals() {
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState(null);

  // Reject modal — kept separate so a reason can be captured deliberately.
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const data = await fetchWithAuth("/admin/faculty/pending");
      if (data.success) setPending(data.faculty);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const removeFromList = (id) =>
    setPending((prev) => prev.filter((f) => f._id !== id));

  const handleApprove = async (faculty) => {
    const ok = await confirm({
      title: `Approve ${faculty.name}?`,
      message:
        "They will be able to sign in and post opportunities for your institution.",
      confirmLabel: "Approve",
    });
    if (!ok) return;

    setBusyId(faculty._id);
    setActionError("");
    try {
      const res = await patchWithAuth(`/admin/faculty/${faculty._id}/approve`);
      if (res.success) {
        removeFromList(faculty._id);
      } else {
        setActionError(res.message || "Could not approve this account.");
      }
    } catch (err) {
      console.error(err);
      setActionError("Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (faculty) => {
    setRejecting(faculty);
    setReason("");
    setActionError("");
  };

  const closeReject = () => {
    setRejecting(null);
    setReason("");
  };

  const handleReject = async () => {
    const faculty = rejecting;
    setBusyId(faculty._id);
    try {
      const res = await patchWithAuth(
        `/admin/faculty/${faculty._id}/reject`,
        { reason: reason.trim() }
      );
      if (res.success) {
        removeFromList(faculty._id);
        closeReject();
      } else {
        setActionError(res.message || "Could not reject this account.");
      }
    } catch (err) {
      console.error(err);
      setActionError("Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const heroSubtitle = loading
    ? "Loading requests…"
    : pending.length === 0
    ? "Every request has been reviewed."
    : `${pending.length} ${
        pending.length === 1 ? "person is" : "people are"
      } waiting for your review.`;

  return (
    <>
      <Navbar />

      <div className="approvals-page">
        <div className="approvals-inner">
          <div className="approvals-hero">
            <p className="approvals-eyebrow">Coordinator</p>
            <h1>Faculty Approvals</h1>
            <p className="approvals-sub">{heroSubtitle}</p>
          </div>

          {actionError && <div className="action-error-bar">{actionError}</div>}

          {loading ? (
            <p className="approvals-loading">Loading…</p>
          ) : pending.length === 0 ? (
            <div className="approvals-empty">
              <div className="approvals-empty-mark">✓</div>
              <h2>You&rsquo;re all caught up</h2>
              <p>
                No faculty are awaiting approval right now. New requests will
                appear here as they come in.
              </p>
            </div>
          ) : (
            <div className="approvals-list">
              {pending.map((f) => (
                <div className="approval-card" key={f._id}>
                  <div className="approval-top">
                    <div className="approval-identity">
                      <Avatar name={f.name} image={f.profileImage} size={52} />
                      <div className="approval-identity-text">
                        <h3>{f.name}</h3>
                        <span className="approval-email">{f.email}</span>
                        <span className="approval-requested">
                          Requested {timeAgo(f.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="approval-actions">
                      <button
                        className="btn btn-danger-ghost btn-sm"
                        onClick={() => openReject(f)}
                        disabled={busyId === f._id}
                      >
                        Reject
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleApprove(f)}
                        disabled={busyId === f._id}
                      >
                        {busyId === f._id ? "Working…" : "Approve"}
                      </button>
                    </div>
                  </div>

                  <div className="approval-details">
                    <div className="approval-fact">
                      <span className="approval-fact-label">Department</span>
                      <span className="approval-fact-value">
                        {f.department || "—"}
                      </span>
                    </div>
                    <div className="approval-fact">
                      <span className="approval-fact-label">Designation</span>
                      <span className="approval-fact-value">
                        {f.designation || "—"}
                      </span>
                    </div>

                    <div
                      className={`approval-verify${
                        f.employeeId ? "" : " missing"
                      }`}
                    >
                      <span className="approval-verify-label">Employee ID</span>
                      <span className="approval-verify-value">
                        {f.employeeId || "Not provided — verify carefully"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {rejecting && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeReject()}
        >
          <div className="modal-card">
            <h3>Reject {rejecting.name}?</h3>
            <p className="modal-hint">
              They will not be able to sign in. A short reason helps them
              understand what to do next.
            </p>

            <label className="modal-label">Reason (optional)</label>
            <textarea
              className="modal-textarea"
              placeholder="e.g. Could not verify the employee ID against the directory."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
            />

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeReject}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleReject}
                disabled={busyId === rejecting._id}
              >
                {busyId === rejecting._id ? "Rejecting…" : "Reject account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Approvals;
