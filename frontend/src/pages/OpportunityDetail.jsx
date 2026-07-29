import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
  fetchWithAuth,
  uploadWithAuth,
  patchWithAuth,
  fileUrl,
} from "../utils/api";
import { useAuth } from "../context/AuthContext";

import Navbar from "./Navbar";
import StatusBadge from "../components/StatusBadge";
import ProfileModal from "../components/ProfileModal";
import { IconFile } from "../components/Icons";
import { useConfirm } from "../components/ConfirmProvider";

import "./OpportunityDetail.css";

const WITHDRAWABLE = ["Applied", "Viewed", "Shortlisted"];

function isEligible(profile, opp) {
  if (!profile || !opp) return false;
  const branchOk =
    opp.eligibleBranches?.includes("All") ||
    (!!profile.branch && opp.eligibleBranches?.includes(profile.branch));
  const yearOk =
    opp.eligibleYears?.includes("All") ||
    (profile.year != null && opp.eligibleYears?.includes(String(profile.year)));
  const genderOk =
    opp.eligibleGender === "Any" || opp.eligibleGender === profile.gender;
  return Boolean(branchOk && yearOk && genderOk);
}

function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const { user: currentUser } = useAuth();

  const [opportunity, setOpportunity] = useState(null);
  const [loading, setLoading] = useState(true);

  // Student application state
  const [profile, setProfile] = useState(null);
  const [myApplication, setMyApplication] = useState(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [showFaculty, setShowFaculty] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetchWithAuth(`/opportunities/${id}`);
        if (response.success) setOpportunity(response.opportunity);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }

      if (currentUser?.role === "Student") {
        try {
          const [profileRes, mineRes] = await Promise.all([
            fetchWithAuth("/auth/profile"),
            fetchWithAuth("/applications/mine"),
          ]);
          if (profileRes.success) setProfile(profileRes.profile);
          if (mineRes.success) {
            const existing = mineRes.applications.find(
              (a) => a.opportunity?._id === id
            );
            setMyApplication(existing || null);
          }
        } catch (error) {
          console.error(error);
        }
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleResumeChange = (e) => {
    const file = e.target.files[0];
    setApplyError("");
    if (!file) {
      setResumeFile(null);
      return;
    }
    if (file.type !== "application/pdf") {
      setApplyError("Resume must be a PDF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setApplyError("Resume must be under 5MB.");
      return;
    }
    setResumeFile(file);
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (coverLetter.trim().length < 20) {
      setApplyError("Cover letter must be at least 20 characters.");
      return;
    }
    setApplying(true);
    setApplyError("");
    try {
      const formData = new FormData();
      formData.append("opportunityId", id);
      formData.append("coverLetter", coverLetter.trim());
      if (resumeFile) formData.append("resume", resumeFile);

      const res = await uploadWithAuth("/applications", formData);
      if (res.success) {
        setMyApplication(res.application);
        setCoverLetter("");
        setResumeFile(null);
      } else {
        setApplyError(res.message || "Could not submit application.");
      }
    } catch (err) {
      console.error(err);
      setApplyError("Something went wrong. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  const handleWithdraw = async () => {
    const ok = await confirm({
      title: "Withdraw application?",
      message:
        "Your application will be withdrawn. You can re-apply later after a short cooldown period.",
      confirmLabel: "Withdraw",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await patchWithAuth(
        `/applications/${myApplication._id}/withdraw`
      );
      if (res.success) {
        setMyApplication({ ...myApplication, status: "Withdrawn" });
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <p className="loading">Loading opportunity...</p>
      </>
    );
  }

  if (!opportunity) {
    return (
      <>
        <Navbar />
        <p className="loading">Opportunity not found.</p>
      </>
    );
  }

  const isStudent = currentUser?.role === "Student";
  const isOwnerFaculty =
    currentUser?.role === "Faculty" &&
    opportunity.postedBy?._id === currentUser.id;
  const isOpen =
    opportunity.status === "Active" &&
    new Date(opportunity.deadline) > new Date();
  const hasActiveApplication =
    myApplication && myApplication.status !== "Withdrawn";

  const renderApplicationPanel = () => {
    if (isOwnerFaculty) {
      return (
        <div className="application-panel">
          <div>
            <h3>Applicants</h3>
            <p className="panel-hint">
              Review and manage students who applied to this opportunity.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/opportunity/${id}/applicants`)}
          >
            View applicants
          </button>
        </div>
      );
    }

    if (!isStudent) return null;

    if (hasActiveApplication) {
      return (
        <div className="application-panel">
          <div>
            <h3>Your application</h3>
            <p className="panel-hint">
              Status: <StatusBadge status={myApplication.status} /> — submitted{" "}
              {new Date(
                myApplication.createdAt || Date.now()
              ).toLocaleDateString()}
            </p>
          </div>
          {WITHDRAWABLE.includes(myApplication.status) && (
            <button className="btn btn-danger-ghost" onClick={handleWithdraw}>
              Withdraw
            </button>
          )}
        </div>
      );
    }

    if (!profile) return null;

    if (!isEligible(profile, opportunity)) {
      return (
        <div className="application-panel">
          <div>
            <h3>Apply</h3>
            <p className="panel-hint">
              You do not meet the eligibility criteria for this opportunity.
            </p>
          </div>
        </div>
      );
    }

    if (!isOpen) {
      return (
        <div className="application-panel">
          <div>
            <h3>Apply</h3>
            <p className="panel-hint">
              This opportunity is no longer accepting applications.
            </p>
          </div>
        </div>
      );
    }

    return (
      <form className="apply-card" onSubmit={handleApply}>
        <h3>Apply to this opportunity</h3>
        {myApplication?.status === "Withdrawn" && (
          <p className="panel-hint">
            You previously withdrew. Re-applying is allowed after a short
            cooldown.
          </p>
        )}

        <label className="apply-label">Cover letter</label>
        <textarea
          className="apply-textarea"
          placeholder="Tell the faculty why you're a good fit (minimum 20 characters)."
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          maxLength={2000}
          rows={5}
        />

        <label className="apply-label">Resume (PDF, optional)</label>
        <div className="apply-file-row">
          <label className="btn btn-secondary btn-sm file-trigger">
            Choose PDF
            <input
              type="file"
              accept="application/pdf"
              onChange={handleResumeChange}
              hidden
            />
          </label>
          <span className="apply-file">
            {resumeFile ? resumeFile.name : "No file chosen"}
          </span>
        </div>

        {applyError && <p className="apply-error">{applyError}</p>}

        <button type="submit" className="btn btn-primary" disabled={applying}>
          {applying ? "Submitting..." : "Submit application"}
        </button>
      </form>
    );
  };

  return (
    <>
      <Navbar />

      <div className="detail-container">
        <div className="detail-card">
          <div className="detail-header">
            <h1 className="detail-title">{opportunity.title}</h1>
            <p className="detail-description">{opportunity.description}</p>
          </div>

          {renderApplicationPanel()}

          <div className="detail-grid">
            <div className="detail-box">
              <p className="detail-label">Category</p>
              <p className="detail-value">{opportunity.category}</p>
            </div>
            <div className="detail-box">
              <p className="detail-label">Posted By</p>
              <p className="detail-value">
                {opportunity.postedBy?.prefix
                  ? `${opportunity.postedBy.prefix} `
                  : ""}
                {opportunity.postedBy?.name}
              </p>
              {opportunity.postedBy?._id && (
                <button
                  className="link-inline"
                  onClick={() => setShowFaculty(true)}
                >
                  View profile
                </button>
              )}
            </div>
            <div className="detail-box">
              <p className="detail-label">Department</p>
              <p className="detail-value">
                {opportunity.postedBy?.department || "Not specified"}
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
              <p className="detail-value">{opportunity.eligibleGender}</p>
            </div>
            <div className="detail-box">
              <p className="detail-label">Contact Email</p>
              <p className="detail-value">{opportunity.contactEmail}</p>
            </div>
            <div className="detail-box">
              <p className="detail-label">Deadline</p>
              <p className="detail-value">
                {new Date(opportunity.deadline).toLocaleDateString()}
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
                    href={fileUrl(att.url)}
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

      {showFaculty && (
        <ProfileModal
          userId={opportunity.postedBy._id}
          onClose={() => setShowFaculty(false)}
        />
      )}
    </>
  );
}

export default OpportunityDetail;
