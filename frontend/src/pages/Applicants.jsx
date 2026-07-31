import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import Navbar from "./Navbar";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Avatar from "../components/Avatar";
import ProfileView from "../components/ProfileView";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { useConfirm } from "../components/ConfirmProvider";
import { useToast } from "../components/ToastProvider";
import { IconArrowLeft } from "../components/Icons";
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
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [opportunity, setOpportunity] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [filter, setFilter] = useState("All");
  const [detail, setDetail] = useState(null); // open applicant detail
  const [detailLoading, setDetailLoading] = useState(false);
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

  const closeDetail = () => {
    setDetail(null);
    setDetailLoading(false);
    setComposing(false);
    setMessageDraft("");
  };

  // Opening an applicant marks the application as Viewed (server-side).
  const openDetail = async (appId) => {
    setDetailLoading(true);
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
        toast.error(res.message || "Could not load applicant.");
        setDetailLoading(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not load applicant.");
      setDetailLoading(false);
    }
  };

  const viewResume = async (appId) => {
    try {
      await openAuthedFile(`/applications/${appId}/resume`);
    } catch (err) {
      toast.error(err.message || "Could not open resume.");
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
        toast.error(res.message || "Could not update status.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    }
  };

  // Faculty opens (or continues) a private conversation with a shortlisted or
  // selected applicant, then hands off to the Messages page.
  const startConversation = async () => {
    const body = messageDraft.trim();
    if (!body) return;
    setMessageSending(true);
    try {
      const res = await postWithAuth("/conversations", {
        applicationId: detail._id,
        body,
      });
      if (res.success) {
        navigate(`/messages/${res.conversation._id}`);
      } else {
        toast.error(res.message || "Could not start the conversation.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not start the conversation.");
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

      <div className="appl">
        <PageHeader
          title="Applicants"
          subtitle={opportunity ? opportunity.title : "Loading…"}
          action={
            <button
              className="btn btn-secondary"
              onClick={() => navigate("/faculty")}
            >
              <IconArrowLeft /> Faculty Corner
            </button>
          }
        />

        <div className="container appl-body">
          <div className="appl-filters" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`appl-filter${filter === f ? " active" : ""}`}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f} <span className="appl-filter-count">{counts[f]}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="appl-status">
              <Spinner center label="Loading applicants" />
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              title={`No applicants${filter !== "All" ? ` in ${filter}` : ""}`}
              description="Applications will appear here as students apply."
            />
          ) : (
            <div className="appl-list">
              {visible.map((app) => (
                <div className="card appl-row" key={app._id}>
                  <div className="appl-identity">
                    <Avatar
                      name={app.student?.name}
                      image={app.student?.profileImage}
                      size={40}
                    />
                    <div>
                      <div className="appl-name-line">
                        <span className="appl-name">
                          {app.student?.name || "Student"}
                        </span>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="appl-meta">
                        {app.student?.branch && <span>{app.student.branch}</span>}
                        {app.student?.year && (
                          <span>Year {app.student.year}</span>
                        )}
                        <span>
                          Applied {new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => openDetail(app._id)}
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Applicant detail */}
      {(detail || detailLoading) && (
        <Modal
          open
          onClose={closeDetail}
          title="Applicant"
          size="lg"
          footer={
            detail && (
              <div className="appl-foot">
                {detail.resume ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => viewResume(detail._id)}
                  >
                    View resume
                  </button>
                ) : (
                  <span className="appl-no-resume">No resume attached</span>
                )}

                <div className="appl-status-actions">
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
            )
          }
        >
          {detail ? (
            <div className="appl-detail">
              <div className="appl-detail-status">
                <StatusBadge status={detail.status} />
              </div>

              <ProfileView profile={detail.student} />

              {detail.student?.email && (
                <div className="appl-section">
                  <span className="appl-label">Contact</span>
                  <a
                    className="appl-email"
                    href={`mailto:${detail.student.email}`}
                  >
                    {detail.student.email}
                  </a>
                </div>
              )}

              <div className="appl-section">
                <span className="appl-label">Cover letter</span>
                <p className="appl-cover">{detail.coverLetter}</p>
              </div>

              {(detail.status === "Shortlisted" ||
                detail.status === "Selected") && (
                <div className="appl-section">
                  <span className="appl-label">Message</span>
                  {!composing ? (
                    <button
                      className="btn btn-secondary btn-sm appl-message-start"
                      onClick={() => setComposing(true)}
                    >
                      Message applicant
                    </button>
                  ) : (
                    <div className="appl-composer">
                      <textarea
                        className="field-control"
                        placeholder={`Message ${
                          detail.student?.name || "the applicant"
                        }`}
                        value={messageDraft}
                        onChange={(e) => setMessageDraft(e.target.value)}
                        rows={3}
                      />
                      <div className="appl-composer-actions">
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
            </div>
          ) : (
            <Spinner center label="Loading applicant" />
          )}
        </Modal>
      )}
    </>
  );
}

export default Applicants;
