import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import Navbar from "./Navbar";
import StatusBadge from "../components/StatusBadge";
import Avatar from "../components/Avatar";
import ProfileView from "../components/ProfileView";
import { useConfirm } from "../components/ConfirmProvider";
import {
  fetchWithAuth,
  patchWithAuth,
  postWithAuth,
  openAuthedFile,
} from "../utils/api";

import "./Applicants.css";

const FILTERS = [
  "All",
  "Applied",
  "Viewed",
  "Shortlisted",
  "Selected",
  "Rejected",
  "Withdrawn",
];

// Allowed next statuses a faculty can set, mirroring the server's transitions.
function actionsFor(status) {
  if (status === "Applied" || status === "Viewed")
    return ["Shortlisted", "Rejected"];
  if (status === "Shortlisted") return ["Selected", "Rejected"];
  return [];
}

const ACTION_LABEL = {
  Shortlisted: "Shortlist",
  Selected: "Select",
  Rejected: "Reject",
};

function Applicants() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [opportunity, setOpportunity] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [filter, setFilter] = useState("All");
  const [detail, setDetail] = useState(null); // open applicant detail
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [composing, setComposing] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageSending, setMessageSending] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = async () => {
    try {
      const [oppRes, appsRes] = await Promise.all([
        fetchWithAuth(`/opportunities/${id}`),
        fetchWithAuth(`/applications/opportunity/${id}`),
      ]);
      if (oppRes.success) setOpportunity(oppRes.opportunity);
      if (appsRes.success) setApplicants(appsRes.applications);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Opening an applicant marks the application as Viewed (server-side).
  const openDetail = async (appId) => {
    setDetailLoading(true);
    setActionError("");
    setComposing(false);
    setMessageDraft("");
    try {
      const res = await fetchWithAuth(`/applications/${appId}`);
      if (res.success) {
        setDetail(res.application);
        // reflect any Applied -> Viewed transition in the list
        setApplicants((prev) =>
          prev.map((a) =>
            a._id === appId ? { ...a, status: res.application.status } : a
          )
        );
      } else {
        setActionError(res.message || "Could not load applicant.");
      }
    } catch (err) {
      console.error(err);
      setActionError("Could not load applicant.");
    } finally {
      setDetailLoading(false);
    }
  };

  const viewResume = async (appId) => {
    setActionError("");
    try {
      await openAuthedFile(`/applications/${appId}/resume`);
    } catch (err) {
      setActionError(err.message || "Could not open resume.");
    }
  };

  const changeStatus = async (appId, status) => {
    if (status === "Rejected" || status === "Selected") {
      const ok = await confirm({
        title: `${ACTION_LABEL[status]} this applicant?`,
        message:
          status === "Rejected"
            ? "The applicant will be marked as rejected."
            : "The applicant will be marked as selected.",
        confirmLabel: ACTION_LABEL[status],
        tone: status === "Rejected" ? "danger" : "primary",
      });
      if (!ok) return;
    }
    setActionError("");
    try {
      const res = await patchWithAuth(`/applications/${appId}/status`, {
        status,
      });
      if (res.success) {
        setApplicants((prev) =>
          prev.map((a) => (a._id === appId ? { ...a, status } : a))
        );
        setDetail((d) => (d && d._id === appId ? { ...d, status } : d));
      } else {
        setActionError(res.message || "Could not update status.");
      }
    } catch (err) {
      console.error(err);
      setActionError("Something went wrong. Please try again.");
    }
  };

  // Faculty opens (or continues) a private conversation with a shortlisted or
  // selected applicant, then hands off to the Messages page.
  const startConversation = async () => {
    const body = messageDraft.trim();
    if (!body) return;
    setMessageSending(true);
    setActionError("");
    try {
      const res = await postWithAuth("/conversations", {
        applicationId: detail._id,
        body,
      });
      if (res.success) {
        navigate(`/messages/${res.conversation._id}`);
      } else {
        setActionError(res.message || "Could not start the conversation.");
      }
    } catch (err) {
      console.error(err);
      setActionError("Could not start the conversation.");
    } finally {
      setMessageSending(false);
    }
  };

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] =
      f === "All"
        ? applicants.length
        : applicants.filter((a) => a.status === f).length;
    return acc;
  }, {});

  const visible =
    filter === "All"
      ? applicants
      : applicants.filter((a) => a.status === filter);

  return (
    <>
      <Navbar />

      <div className="applicants-container">
        <div className="applicants-inner">
          <button className="link-back" onClick={() => navigate("/faculty")}>
            ← Back to Faculty Corner
          </button>

          <div className="applicants-hero">
            <h1>Applicants</h1>
            <p>{opportunity ? opportunity.title : "Loading…"}</p>
          </div>

          {actionError && <div className="action-error-bar">{actionError}</div>}

          <div className="filter-tabs">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`filter-tab${filter === f ? " active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f} <span className="filter-count">{counts[f]}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <p className="applicants-loading">Loading…</p>
          ) : visible.length === 0 ? (
            <div className="applicants-empty">
              <h2>No applicants{filter !== "All" ? ` in ${filter}` : ""}</h2>
              <p>Applications will appear here as students apply.</p>
            </div>
          ) : (
            <div className="applicants-list">
              {visible.map((app) => (
                <div className="applicant-row" key={app._id}>
                  <div className="applicant-identity">
                    <Avatar
                      name={app.student?.name}
                      image={app.student?.profileImage}
                      size={40}
                    />
                    <div>
                      <div className="applicant-name-line">
                        <span className="applicant-name">
                          {app.student?.name || "Student"}
                        </span>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="applicant-meta">
                        <span>{app.student?.branch || "—"}</span>
                        <span>
                          {app.student?.year ? `Year ${app.student.year}` : "—"}
                        </span>
                        <span>
                          Applied {new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="applicant-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openDetail(app._id)}
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* APPLICANT DETAIL MODAL */}
      {detail && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setDetail(null)}
        >
          <div className="modal-card applicant-modal">
            <div className="applicant-status-row">
              <StatusBadge status={detail.status} />
            </div>

            <ProfileView profile={detail.student} />

            {detail.student?.email && (
              <div className="applicant-section">
                <span className="fact-label">Contact</span>
                <a
                  className="applicant-email"
                  href={`mailto:${detail.student.email}`}
                >
                  {detail.student.email}
                </a>
              </div>
            )}

            <div className="applicant-section">
              <span className="fact-label">Cover letter</span>
              <p className="applicant-cover-text">{detail.coverLetter}</p>
            </div>

            <div className="applicant-modal-actions">
              {detail.resume ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => viewResume(detail._id)}
                >
                  View resume
                </button>
              ) : (
                <span className="no-resume">No resume attached</span>
              )}

              <div className="status-actions">
                {actionsFor(detail.status).map((target) => (
                  <button
                    key={target}
                    className={`btn btn-sm ${
                      target === "Rejected"
                        ? "btn-danger-ghost"
                        : target === "Selected"
                        ? "btn-primary"
                        : "btn-secondary"
                    }`}
                    onClick={() => changeStatus(detail._id, target)}
                  >
                    {ACTION_LABEL[target]}
                  </button>
                ))}
              </div>
            </div>

            {(detail.status === "Shortlisted" ||
              detail.status === "Selected") && (
              <div className="applicant-section applicant-message">
                {!composing ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setComposing(true)}
                  >
                    Message applicant
                  </button>
                ) : (
                  <div className="applicant-composer">
                    <textarea
                      className="applicant-composer-input"
                      placeholder={`Message ${
                        detail.student?.name || "the applicant"
                      }…`}
                      value={messageDraft}
                      onChange={(e) => setMessageDraft(e.target.value)}
                      rows={3}
                    />
                    <div className="applicant-composer-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setComposing(false);
                          setMessageDraft("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={messageSending || !messageDraft.trim()}
                        onClick={startConversation}
                      >
                        {messageSending ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              className="btn btn-ghost btn-sm modal-close"
              onClick={() => setDetail(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {detailLoading && <div className="detail-loading-veil">Loading…</div>}
    </>
  );
}

export default Applicants;
