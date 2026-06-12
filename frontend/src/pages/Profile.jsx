import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { fetchWithAuth, putWithAuth } from "../utils/api";
import "./Profile.css";

function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/");
      return;
    }
    loadProfile();
  }, [navigate]);

  const loadProfile = async () => {
    try {
      const data = await fetchWithAuth("/auth/profile");
      if (data.success) {
        setProfile(data.profile);
        setDraft(data.profile);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setDraft({ ...draft, [e.target.name]: e.target.value });
  };

  const handleEdit = () => {
    setDraft({ ...profile });
    setSaveError("");
    setEditMode(true);
  };

  const handleCancel = () => {
    setDraft({ ...profile });
    setSaveError("");
    setEditMode(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const result = await putWithAuth("/auth/profile", {
        name: draft.name,
        department: draft.department,
        designation: draft.designation,
        interests: draft.interests,
        bio: draft.bio,
        linkedinUrl: draft.linkedinUrl,
      });

      if (result.success) {
        setProfile(result.profile);
        setDraft(result.profile);
        setEditMode(false);
      } else {
        setSaveError(result.message || "Failed to save. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setSaveError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="profile-loading">Loading profile…</div>
      </>
    );
  }

  const profileFields = [profile?.bio, profile?.department, profile?.designation, profile?.interests, profile?.linkedinUrl];
  const completion = Math.round(
    (profileFields.filter((f) => f && f.toString().trim() !== "").length / profileFields.length) * 100
  );

  const current = editMode ? draft : profile;

  return (
    <>
      <Navbar />

      <div className="profile-page">
        <div className="profile-inner">

          {/* ── HERO ── */}
          <div className="profile-hero">
            <div className="profile-avatar-large">
              {profile?.name?.charAt(0)?.toUpperCase()}
            </div>

            <div className="profile-hero-info">
              <h1>{profile.name}</h1>
              <p className="profile-role">
                {profile.role}{profile.department ? ` · ${profile.department}` : ""}
              </p>

              <div className="completion-wrapper">
                <div className="completion-label">
                  <span>Profile completion</span>
                  <span className="completion-pct">{completion}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${completion}%` }} />
                </div>
              </div>
            </div>

            <div className="profile-hero-actions">
              {editMode ? (
                <>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                  <button className="btn btn-secondary" onClick={handleCancel}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={handleEdit}>
                  Edit Profile
                </button>
              )}
              {saveError && <p className="profile-save-error">{saveError}</p>}
            </div>
          </div>

          {/* ── ABOUT ── */}
          <div className="profile-about-card">
            <h2>About Me</h2>
            {editMode ? (
              <textarea
                name="bio"
                value={current.bio || ""}
                onChange={handleChange}
                placeholder="Tell students about your research interests, expertise and academic journey."
                rows={4}
              />
            ) : (
              <p>
                {profile.bio || "Tell students about your research interests, expertise and academic journey."}
              </p>
            )}
          </div>

          {/* ── INFO GRID ── */}
          <div className="profile-grid">

            {/* Professional */}
            <div className="profile-info-card">
              <h3>Professional Information</h3>

              <div className="profile-field">
                <label>Full Name</label>
                <input
                  name="name"
                  value={current.name || ""}
                  disabled={!editMode}
                  onChange={handleChange}
                />
              </div>

              <div className="profile-field">
                <label>Department</label>
                <input
                  name="department"
                  value={current.department || ""}
                  disabled={!editMode}
                  onChange={handleChange}
                  placeholder={editMode ? "e.g. DCSE" : "—"}
                />
              </div>

              <div className="profile-field">
                <label>Designation</label>
                <input
                  name="designation"
                  value={current.designation || ""}
                  disabled={!editMode}
                  onChange={handleChange}
                  placeholder={editMode ? "e.g. Assistant Professor" : "—"}
                />
              </div>

              <div className="profile-field">
                <label>Research Interests</label>
                <input
                  name="interests"
                  value={current.interests || ""}
                  disabled={!editMode}
                  onChange={handleChange}
                  placeholder={editMode ? "e.g. Machine Learning, IoT" : "—"}
                />
              </div>
            </div>

            {/* Contact */}
            <div className="profile-info-card">
              <h3>Contact &amp; Links</h3>

              <div className="profile-field">
                <label>Email</label>
                <input value={profile.email || ""} disabled />
              </div>

              <div className="profile-field">
                <label>LinkedIn URL</label>
                <input
                  name="linkedinUrl"
                  value={current.linkedinUrl || ""}
                  disabled={!editMode}
                  onChange={handleChange}
                  placeholder={editMode ? "https://linkedin.com/in/yourname" : "—"}
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

export default Profile;
