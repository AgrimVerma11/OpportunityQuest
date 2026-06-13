import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import Avatar from "../components/Avatar";
import AvatarCropper from "../components/AvatarCropper";
import {
  fetchWithAuth,
  putWithAuth,
  uploadWithAuth,
  deleteWithAuth,
} from "../utils/api";
import {
  SKILL_OPTIONS,
  MAX_SKILLS,
  POSITION_OPTIONS,
  POSITION_BY_YEAR,
  BRANCH_OPTIONS,
  YEAR_OPTIONS,
  BIO_MAX_LENGTH,
} from "../constants/profileOptions";
import "./Profile.css";

const EMPTY_PROJECT = { title: "", description: "" };

function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [cropFile, setCropFile] = useState(null);

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

  const isStudent = profile?.role === "Student";

  // ── Draft editing helpers ──
  const setField = (name, value) => setDraft((d) => ({ ...d, [name]: value }));
  const handleChange = (e) => setField(e.target.name, e.target.value);

  const addSkill = (skill) => {
    if (!skill) return;
    setDraft((d) => {
      const skills = d.skills || [];
      if (skills.includes(skill) || skills.length >= MAX_SKILLS) return d;
      return { ...d, skills: [...skills, skill] };
    });
  };

  const removeSkill = (skill) =>
    setDraft((d) => ({
      ...d,
      skills: (d.skills || []).filter((s) => s !== skill),
    }));

  const setSociety = (field, value) =>
    setDraft((d) => ({ ...d, society: { ...(d.society || {}), [field]: value } }));

  const setProject = (index, field, value) =>
    setDraft((d) => {
      const projects = [0, 1].map((i) => d.projects?.[i] || { ...EMPTY_PROJECT });
      projects[index] = { ...projects[index], [field]: value };
      return { ...d, projects };
    });

  // ── Avatar upload ──
  // Picking a file opens the cropper; the cropped result is what we upload.
  const handleImagePick = (e) => {
    const file = e.target.files[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setSaveError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setSaveError("Profile image must be a JPG, PNG or WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSaveError("Profile image must be under 2MB.");
      return;
    }
    setCropFile(file);
  };

  const handleCroppedUpload = async (blob) => {
    setCropFile(null);
    setUploadingImage(true);
    setSaveError("");
    try {
      const formData = new FormData();
      formData.append("image", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const res = await uploadWithAuth("/auth/profile/image", formData);
      if (res.success) {
        setProfile(res.profile);
        setDraft((d) => ({ ...d, profileImage: res.profile.profileImage }));
        syncCurrentUser({ profileImage: res.profile.profileImage });
      } else {
        setSaveError(res.message || "Could not upload image.");
      }
    } catch (err) {
      console.error(err);
      setSaveError("Could not upload image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    setSaveError("");
    setUploadingImage(true);
    try {
      const res = await deleteWithAuth("/auth/profile/image");
      if (res.success) {
        setProfile(res.profile);
        setDraft((d) => ({ ...d, profileImage: "" }));
        syncCurrentUser({ profileImage: "" });
      } else {
        setSaveError(res.message || "Could not remove image.");
      }
    } catch (err) {
      console.error(err);
      setSaveError("Could not remove image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  // Keep the navbar's cached user in sync for name / prefix / image.
  const syncCurrentUser = (patch) => {
    const current = JSON.parse(localStorage.getItem("currentUser") || "null");
    if (current) {
      localStorage.setItem(
        "currentUser",
        JSON.stringify({ ...current, ...patch })
      );
    }
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

    const payload = isStudent
      ? {
          name: draft.name,
          branch: draft.branch || "",
          year: draft.year ? Number(draft.year) : null,
          skills: draft.skills || [],
          society: {
            name: draft.society?.name || "",
            position: draft.society?.position || "",
          },
          projects: (draft.projects || [])
            .filter((p) => p && p.title?.trim())
            .map((p) => ({
              title: p.title.trim(),
              description: (p.description || "").trim(),
            })),
          interests: draft.interests || "",
          bio: draft.bio || "",
          linkedinUrl: draft.linkedinUrl || "",
        }
      : {
          name: draft.name,
          prefix: draft.prefix || "",
          department: draft.department || "",
          designation: draft.designation || "",
          office: draft.office || "",
          interests: draft.interests || "",
          bio: draft.bio || "",
          linkedinUrl: draft.linkedinUrl || "",
        };

    try {
      const result = await putWithAuth("/auth/profile", payload);
      if (result.success) {
        setProfile(result.profile);
        setDraft(result.profile);
        setEditMode(false);
        syncCurrentUser({
          name: result.profile.name,
          prefix: result.profile.prefix || "",
        });
      } else {
        setSaveError(
          result.errors?.[0] || result.message || "Failed to save. Please try again."
        );
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

  const completionFields = isStudent
    ? [
        profile.bio,
        profile.branch,
        profile.year,
        profile.skills?.length,
        profile.society?.name,
        profile.projects?.length,
        profile.interests,
        profile.linkedinUrl,
      ]
    : [
        profile.bio,
        profile.department,
        profile.designation,
        profile.interests,
        profile.linkedinUrl,
      ];
  const completion = Math.round(
    (completionFields.filter((f) => f && f.toString().trim() !== "").length /
      completionFields.length) *
      100
  );

  const current = editMode ? draft : profile;
  const displayName =
    !isStudent && profile.prefix ? `${profile.prefix} ${profile.name}` : profile.name;

  return (
    <>
      <Navbar />

      <div className="profile-page">
        <div className="profile-inner">

          {/* HERO */}
          <div className="profile-hero">
            <div className="profile-avatar-wrap">
              <Avatar name={profile.name} image={profile.profileImage} size={88} />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={handleImagePick}
              />
              <div className="avatar-actions">
                <button
                  type="button"
                  className="avatar-edit-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? "Working…" : profile.profileImage ? "Change" : "Add photo"}
                </button>
                {profile.profileImage && !uploadingImage && (
                  <button
                    type="button"
                    className="avatar-remove-btn"
                    onClick={handleRemoveImage}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="profile-hero-info">
              <h1>{displayName}</h1>
              <p className="profile-role">
                {profile.role}
                {isStudent
                  ? profile.branch
                    ? ` · ${profile.branch}`
                    : ""
                  : profile.department
                  ? ` · ${profile.department}`
                  : ""}
              </p>

              <div className="completion-wrapper">
                <div className="completion-label">
                  <span>Profile completion</span>
                  <span className="completion-pct">{completion}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="profile-hero-actions">
              {editMode ? (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
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

          {/* ABOUT */}
          <div className="profile-about-card">
            <h2>About Me</h2>
            {editMode ? (
              <>
                <textarea
                  name="bio"
                  value={current.bio || ""}
                  onChange={handleChange}
                  maxLength={BIO_MAX_LENGTH}
                  placeholder={
                    isStudent
                      ? "A short introduction about yourself, your interests and goals."
                      : "Tell students about your research interests, expertise and academic journey."
                  }
                  rows={4}
                />
                <div
                  className={`char-counter${
                    (current.bio || "").length >= BIO_MAX_LENGTH ? " at-limit" : ""
                  }`}
                >
                  {(current.bio || "").length}/{BIO_MAX_LENGTH}
                </div>
              </>
            ) : (
              <p>{profile.bio || "No bio added yet."}</p>
            )}
          </div>

          {isStudent ? renderStudent() : renderFaculty()}
        </div>
      </div>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onSave={handleCroppedUpload}
        />
      )}
    </>
  );

  // ── Faculty layout ──
  function renderFaculty() {
    return (
      <div className="profile-grid">
        <div className="profile-info-card">
          <h3>Professional Information</h3>

          <Field label="Title">
            {editMode ? (
              <select name="prefix" value={current.prefix || ""} onChange={handleChange}>
                <option value="">None</option>
                <option value="Dr.">Dr.</option>
                <option value="Prof.">Prof.</option>
              </select>
            ) : (
              <ReadValue value={profile.prefix} />
            )}
          </Field>

          <Field label="Full Name">
            <input
              name="name"
              value={current.name || ""}
              disabled={!editMode}
              onChange={handleChange}
            />
          </Field>

          <Field label="Department">
            <input
              name="department"
              value={current.department || ""}
              disabled={!editMode}
              onChange={handleChange}
              placeholder={editMode ? "e.g. DCSE" : "—"}
            />
          </Field>

          <Field label="Designation">
            <input
              name="designation"
              value={current.designation || ""}
              disabled={!editMode}
              onChange={handleChange}
              placeholder={editMode ? "e.g. Assistant Professor" : "—"}
            />
          </Field>

          <Field label="Cabin / Office">
            <input
              name="office"
              value={current.office || ""}
              disabled={!editMode}
              onChange={handleChange}
              placeholder={editMode ? "e.g. Cabin G-204, CSED Block" : "—"}
            />
          </Field>

          <Field label="Research Interests">
            <input
              name="interests"
              value={current.interests || ""}
              disabled={!editMode}
              onChange={handleChange}
              placeholder={editMode ? "e.g. Machine Learning, IoT" : "—"}
            />
          </Field>
        </div>

        {renderContactCard()}
      </div>
    );
  }

  // ── Student layout ──
  function renderStudent() {
    const skills = current.skills || [];
    const projects = [0, 1].map((i) => current.projects?.[i] || EMPTY_PROJECT);
    const suggestedPosition = current.year
      ? POSITION_BY_YEAR[current.year]
      : "";

    return (
      <>
        <div className="profile-grid">
          <div className="profile-info-card">
            <h3>Academic Details</h3>

            <Field label="Full Name">
              <input
                name="name"
                value={current.name || ""}
                disabled={!editMode}
                onChange={handleChange}
              />
            </Field>

            <Field label="Branch">
              {editMode ? (
                <select name="branch" value={current.branch || ""} onChange={handleChange}>
                  <option value="">Select branch</option>
                  {BRANCH_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadValue value={profile.branch} />
              )}
            </Field>

            <Field label="Year">
              {editMode ? (
                <select name="year" value={current.year || ""} onChange={handleChange}>
                  <option value="">Select year</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadValue value={profile.year ? `Year ${profile.year}` : ""} />
              )}
            </Field>
          </div>

          {renderContactCard()}
        </div>

        {/* SKILLS */}
        <div className="profile-info-card">
          <h3>Top Skills</h3>
          {editMode && (
            <div className="skill-picker">
              <select
                value=""
                onChange={(e) => addSkill(e.target.value)}
                disabled={skills.length >= MAX_SKILLS}
              >
                <option value="">
                  {skills.length >= MAX_SKILLS
                    ? `Maximum ${MAX_SKILLS} skills`
                    : "Add a skill…"}
                </option>
                {SKILL_OPTIONS.filter((s) => !skills.includes(s)).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="skill-hint">Choose up to {MAX_SKILLS}.</span>
            </div>
          )}
          <div className="skill-chips">
            {skills.length === 0 && <span className="muted">No skills added.</span>}
            {skills.map((s) => (
              <span className="skill-chip" key={s}>
                {s}
                {editMode && (
                  <button type="button" onClick={() => removeSkill(s)}>
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* SOCIETY */}
        <div className="profile-info-card">
          <h3>Society / Club</h3>
          {Number(current.year) === 4 && editMode && (
            <p className="muted small">
              Final-year students are usually not active society members.
            </p>
          )}
          <div className="profile-two-col">
            <Field label="Society / Club">
              <input
                value={current.society?.name || ""}
                disabled={!editMode}
                onChange={(e) => setSociety("name", e.target.value)}
                placeholder={editMode ? "e.g. ACM Student Chapter" : "—"}
              />
            </Field>
            <Field label="Position">
              {editMode ? (
                <select
                  value={current.society?.position || ""}
                  onChange={(e) => setSociety("position", e.target.value)}
                >
                  <option value="">
                    {suggestedPosition
                      ? `Suggested: ${suggestedPosition}`
                      : "Select position"}
                  </option>
                  {POSITION_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              ) : (
                <ReadValue value={profile.society?.position} />
              )}
            </Field>
          </div>
        </div>

        {/* PROJECTS */}
        <div className="profile-info-card">
          <h3>Projects</h3>
          {!editMode && projects.every((p) => !p.title) && (
            <span className="muted">No projects added.</span>
          )}
          {projects.map((p, i) =>
            editMode || p.title ? (
              <div className="project-block" key={i}>
                <Field label={`Project ${i + 1}`}>
                  <input
                    value={p.title || ""}
                    disabled={!editMode}
                    onChange={(e) => setProject(i, "title", e.target.value)}
                    placeholder={editMode ? "Project title" : "—"}
                  />
                </Field>
                {(editMode || p.description) && (
                  <textarea
                    className="project-desc"
                    value={p.description || ""}
                    disabled={!editMode}
                    onChange={(e) => setProject(i, "description", e.target.value)}
                    placeholder={editMode ? "What it does, your role, the stack…" : ""}
                    rows={2}
                  />
                )}
              </div>
            ) : null
          )}
        </div>

        {/* INTERESTS */}
        <div className="profile-info-card">
          <h3>Areas of Interest</h3>
          {editMode ? (
            <div className="profile-field">
              <input
                name="interests"
                value={current.interests || ""}
                onChange={handleChange}
                placeholder="e.g. Backend engineering, Competitive programming"
              />
            </div>
          ) : (
            <p className="muted">{profile.interests || "Not specified."}</p>
          )}
        </div>
      </>
    );
  }

  function renderContactCard() {
    return (
      <div className="profile-info-card">
        <h3>Contact &amp; Links</h3>
        <Field label="Email">
          <input value={profile.email || ""} disabled />
        </Field>
        <Field label="LinkedIn URL">
          <input
            name="linkedinUrl"
            value={current.linkedinUrl || ""}
            disabled={!editMode}
            onChange={handleChange}
            placeholder={editMode ? "https://linkedin.com/in/yourname" : "—"}
          />
        </Field>
      </div>
    );
  }
}

// Small presentational helpers
function Field({ label, children }) {
  return (
    <div className="profile-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function ReadValue({ value }) {
  return <input value={value || ""} disabled placeholder="—" />;
}

export default Profile;
