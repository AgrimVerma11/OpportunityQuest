import { useEffect, useState } from "react";

import Navbar from "./Navbar";
import PageHero from "../components/PageHero";
import Button from "../components/Button";
import Avatar from "../components/Avatar";
import Modal from "../components/Modal";
import Field from "../components/Field";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { useConfirm } from "../components/ConfirmProvider";
import { useToast } from "../components/ToastProvider";
import { IconCheck } from "../components/Icons";
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
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
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
    try {
      const res = await patchWithAuth(`/admin/faculty/${faculty._id}/approve`);
      if (res.success) {
        removeFromList(faculty._id);
        toast.success(`${faculty.name} approved.`);
      } else {
        toast.error(res.message || "Could not approve this account.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (faculty) => {
    setRejecting(faculty);
    setReason("");
  };

  const closeReject = () => {
    setRejecting(null);
    setReason("");
  };

  const handleReject = async () => {
    const faculty = rejecting;
    setBusyId(faculty._id);
    try {
      const res = await patchWithAuth(`/admin/faculty/${faculty._id}/reject`, {
        reason: reason.trim(),
      });
      if (res.success) {
        removeFromList(faculty._id);
        closeReject();
        toast.success(`${faculty.name}'s request was rejected.`);
      } else {
        toast.error(res.message || "Could not reject this account.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const subtitle = loading
    ? "Loading requests…"
    : pending.length === 0
    ? "Every request has been reviewed."
    : `${pending.length} ${
        pending.length === 1 ? "person is" : "people are"
      } waiting for your review.`;

  return (
    <>
      <Navbar />

      <div className="approvals">
        <PageHero title="Faculty approvals" subtitle={subtitle} />

        <div className="container approvals-body">
          {loading ? (
            <div className="approvals-status">
              <Spinner center label="Loading requests" />
            </div>
          ) : pending.length === 0 ? (
            <EmptyState
              icon={<IconCheck />}
              title="You’re all caught up"
              description="No faculty are awaiting approval right now. New requests will appear here as they come in."
            />
          ) : (
            <div className="approvals-list">
              {pending.map((f) => (
                <div className="oq-card approval-card" key={f._id}>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="approval-reject"
                        onClick={() => openReject(f)}
                        disabled={busyId === f._id}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(f)}
                        disabled={busyId === f._id}
                      >
                        {busyId === f._id ? "Working…" : "Approve"}
                      </Button>
                    </div>
                  </div>

                  <div className="approval-details">
                    <div className="approval-fact">
                      <span className="approval-fact-label">Department</span>
                      <span className="approval-fact-value">
                        {f.department || "Not specified"}
                      </span>
                    </div>
                    <div className="approval-fact">
                      <span className="approval-fact-label">Designation</span>
                      <span className="approval-fact-value">
                        {f.designation || "Not specified"}
                      </span>
                    </div>

                    <div
                      className={`approval-verify${
                        f.employeeId ? "" : " missing"
                      }`}
                    >
                      <span className="approval-verify-label">Employee ID</span>
                      <span className="approval-verify-value">
                        {f.employeeId || "Not provided (verify carefully)"}
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
        <Modal
          open
          onClose={closeReject}
          title={`Reject ${rejecting.name}?`}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={closeReject}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                disabled={busyId === rejecting._id}
              >
                {busyId === rejecting._id ? "Rejecting…" : "Reject account"}
              </Button>
            </>
          }
        >
          <p className="approvals-modal-hint">
            They will not be able to sign in. A short reason helps them
            understand what to do next.
          </p>
          <Field id="reject-reason" label="Reason (optional)">
            <textarea
              placeholder="e.g. Could not verify the employee ID against the directory."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </Field>
        </Modal>
      )}
    </>
  );
}

export default Approvals;
