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
import Avatar from "../components/Avatar";
import Tag from "../components/Tag";
import UrgencyChip from "../components/UrgencyChip";
import SkillChip from "../components/SkillChip";
import Button from "../components/Button";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import Field from "../components/Field";
import ProfileModal from "../components/ProfileModal";
import { IconFile, IconAlert, IconArrowLeft } from "../components/Icons";
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
        <div className="container detail-state">
          <Spinner center label="Loading opportunity" />
        </div>
      </>
    );
  }

  if (!opportunity) {
    return (
      <>
        <Navbar />
        <div className="container detail-state">
          <EmptyState
            icon={<IconAlert />}
            title="Opportunity not found"
            description="This opportunity may have been removed, or the link is incorrect."
            action={
              <Button variant="outline" onClick={() => navigate("/home")}>
                Back to opportunities
              </Button>
            }
          />
        </div>
      </>
    );
  }

  const isStudent = currentUser?.role === "Student";
  // The poster (faculty or coordinator) owns this opportunity's management.
  const isOwner = opportunity.postedBy?._id === currentUser.id;
  const isOpen =
    opportunity.status === "Active" &&
    new Date(opportunity.deadline) > new Date();
  const hasActiveApplication =
    myApplication && myApplication.status !== "Withdrawn";

  const renderApplicationPanel = () => {
    if (isOwner) {
      return (
        <div className="oq-card detail-apply">
          <h2 className="detail-apply-title">Applicants</h2>
          <p className="detail-apply-hint">
            Review and manage students who applied to this opportunity.
          </p>
          <Button
            variant="primary"
            block
            onClick={() => navigate(`/opportunity/${id}/applicants`)}
          >
            View applicants
          </Button>
        </div>
      );
    }

    if (!isStudent) return null;

    if (hasActiveApplication) {
      return (
        <div className="oq-card detail-apply">
          <h2 className="detail-apply-title">Your application</h2>
          <div className="detail-apply-status">
            <Tag status={myApplication.status} />
            <span className="detail-apply-date">
              Submitted{" "}
              {new Date(
                myApplication.createdAt || Date.now()
              ).toLocaleDateString()}
            </span>
          </div>
          {WITHDRAWABLE.includes(myApplication.status) && (
            <Button
              variant="outline"
              block
              className="detail-withdraw"
              onClick={handleWithdraw}
            >
              Withdraw application
            </Button>
          )}
        </div>
      );
    }

    if (!profile) return null;

    if (!isEligible(profile, opportunity)) {
      return (
        <div className="oq-card detail-apply">
          <h2 className="detail-apply-title">Apply</h2>
          <p className="detail-apply-hint">
            You do not meet the eligibility criteria for this opportunity.
          </p>
        </div>
      );
    }

    if (!isOpen) {
      return (
        <div className="oq-card detail-apply">
          <h2 className="detail-apply-title">Apply</h2>
          <p className="detail-apply-hint">
            This opportunity is no longer accepting applications.
          </p>
        </div>
      );
    }

    return (
      <form className="oq-card detail-apply" onSubmit={handleApply}>
        <h2 className="detail-apply-title">Apply to this opportunity</h2>
        {myApplication?.status === "Withdrawn" && (
          <p className="detail-apply-hint">
            You previously withdrew. Re-applying is allowed after a short
            cooldown.
          </p>
        )}

        <Field
          id="coverLetter"
          label="Cover letter"
          hint="Minimum 20 characters."
        >
          <textarea
            placeholder="Tell the faculty why you are a good fit."
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            maxLength={2000}
            rows={6}
          />
        </Field>

        <div className="detail-file">
          <span className="detail-file-label">Resume (PDF, optional)</span>
          <div className="detail-file-row">
            <label className="detail-file-btn">
              Choose PDF
              <input
                type="file"
                accept="application/pdf"
                onChange={handleResumeChange}
                hidden
              />
            </label>
            <span className="detail-file-name">
              {resumeFile ? resumeFile.name : "No file chosen"}
            </span>
          </div>
        </div>

        {applyError && <p className="field-error">{applyError}</p>}

        <Button type="submit" variant="primary" block disabled={applying}>
          {applying ? "Submitting…" : "Submit application"}
        </Button>
      </form>
    );
  };

  const panel = renderApplicationPanel();

  return (
    <>
      <Navbar />

      <div className="detail">
        <div className="container detail-top">
          <button
            type="button"
            className="detail-back"
            onClick={() => navigate(-1)}
          >
            <IconArrowLeft /> Back
          </button>

          <div className="detail-hero-tags">
            <Tag category={opportunity.category} />
            <UrgencyChip deadline={opportunity.deadline} />
          </div>

          <h1 className="detail-title">{opportunity.title}</h1>

          <div className="detail-poster">
            <Avatar
              name={opportunity.postedBy?.name}
              image={opportunity.postedBy?.profileImage}
              size={40}
            />
            <div className="detail-poster-meta">
              <span className="detail-poster-name">
                {opportunity.postedBy?.prefix
                  ? `${opportunity.postedBy.prefix} `
                  : ""}
                {opportunity.postedBy?.name}
              </span>
              {opportunity.postedBy?.department && (
                <span className="detail-poster-sub">
                  {opportunity.postedBy.department}
                </span>
              )}
            </div>
            {opportunity.postedBy?._id && (
              <Button
                variant="outline"
                size="sm"
                className="detail-poster-btn"
                onClick={() => setShowFaculty(true)}
              >
                View profile
              </Button>
            )}
          </div>
        </div>

        <div className="container detail-body">
          <div className="detail-main">
            <section className="oq-card detail-section">
              <h2 className="detail-section-title">About this opportunity</h2>
              <p className="detail-about">{opportunity.description}</p>
            </section>

            <section className="oq-card detail-section">
              <h2 className="detail-section-title">Details</h2>
              <dl className="detail-facts">
                <div className="detail-fact">
                  <dt>Eligible branches</dt>
                  <dd>{opportunity.eligibleBranches?.join(", ") || "All"}</dd>
                </div>
                <div className="detail-fact">
                  <dt>Eligible years</dt>
                  <dd>{opportunity.eligibleYears?.join(", ") || "All"}</dd>
                </div>
                <div className="detail-fact">
                  <dt>Eligible gender</dt>
                  <dd>{opportunity.eligibleGender}</dd>
                </div>
                <div className="detail-fact">
                  <dt>Deadline</dt>
                  <dd>
                    {new Date(opportunity.deadline).toLocaleDateString()}
                  </dd>
                </div>
                <div className="detail-fact">
                  <dt>Department</dt>
                  <dd>{opportunity.postedBy?.department || "Not specified"}</dd>
                </div>
                <div className="detail-fact">
                  <dt>Contact</dt>
                  <dd>
                    {opportunity.contactEmail ? (
                      <a href={`mailto:${opportunity.contactEmail}`}>
                        {opportunity.contactEmail}
                      </a>
                    ) : (
                      "Not specified"
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            {opportunity.tags?.filter((t) => t.trim() !== "").length > 0 && (
              <section className="oq-card detail-section">
                <h2 className="detail-section-title">Tags</h2>
                <div className="detail-tags">
                  {opportunity.tags
                    .filter((t) => t.trim() !== "")
                    .map((tag, index) => (
                      <SkillChip key={index}>{tag}</SkillChip>
                    ))}
                </div>
              </section>
            )}

            {opportunity.attachments?.length > 0 && (
              <section className="oq-card detail-section">
                <h2 className="detail-section-title">Attachments</h2>
                <div className="detail-attachments">
                  {opportunity.attachments.map((att) => (
                    <a
                      key={att._id}
                      href={fileUrl(att.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="detail-attachment"
                    >
                      <IconFile />
                      <span>{att.originalName}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {opportunity.deadlineHistory?.length > 0 && (
              <section className="oq-card detail-section">
                <h2 className="detail-section-title">Deadline history</h2>
                <ul className="detail-history">
                  {opportunity.deadlineHistory.map((entry, i) => (
                    <li key={i} className="detail-history-item">
                      Changed on{" "}
                      {new Date(entry.extendedAt).toLocaleDateString()}. Previous
                      deadline was{" "}
                      {new Date(entry.previousDeadline).toLocaleDateString()}
                      {entry.reason && ` (${entry.reason})`}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {panel && <aside className="detail-side">{panel}</aside>}
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
