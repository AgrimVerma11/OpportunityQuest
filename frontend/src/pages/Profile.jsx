import { useEffect, useRef, useState } from "react";
import Navbar from "./Navbar";
import { useAuth } from "../context/AuthContext";
import Avatar from "../components/Avatar";
import AvatarCropper from "../components/AvatarCropper";
import Button from "../components/Button";
import ProgressBar from "../components/ProgressBar";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastProvider";
import { IconX } from "../components/Icons";
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

// One field: a label, and either the edit control (edit mode) or the saved
// value rendered as clean text (read mode).
function ProfileField({ label, value, editMode, children }) {
  return (
    <div className="pf-field">
      <span className="pf-label">{label}</span>
      {editMode && children ? (
        children
      ) : value != null && value !== "" ? (
        <span className="pf-value">{value}</span>
      ) : (
        <span className="pf-value pf-empty">Not added</span>
      )}
    </div>
  );
}

function Profile() {
  const { updateUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [cropFile, setCropFile] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

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
  const handleImagePick = (e) => {
    const file = e.target.files[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Profile image must be a JPG, PNG or WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profile image must be under 2MB.");
      return;
    }
    setCropFile(file);
  };

  const handleCroppedUpload = async (blob) => {
    setCropFile(null);
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const res = await uploadWithAuth("/auth/profile/image", formData);
      if (res.success) {
        setProfile(res.profile);
        setDraft((d) => ({ ...d, profileImage: res.profile.profileImage }));
        updateUser({ profileImage: res.profile.profileImage });
      } else {
        toast.error(res.message || "Could not upload image.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not upload image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    setUploadingImage(true);
    try {
      const res = await deleteWithAuth("/auth/profile/image");
      if (res.success) {
        setProfile(res.profile);
        setDraft((d) => ({ ...d, profileImage: "" }));
        updateUser({ profileImage: "" });
      } else {
        toast.error(res.message || "Could not remove image.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not remove image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleEdit = () => {
    setDraft({ ...profile });
    setEditMode(true);
  };

  const handleCancel = () => {
    setDraft({ ...profile });
    setEditMode(false);
  };

  const handleSave = async () => {
    setSaving(true);

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
        updateUser({
          name: result.profile.name,
          prefix: result.profile.prefix || "",
        });
        toast.success("Profile saved.");
      } else {
        toast.error(
          result.errors?.[0] || result.message || "Failed to save. Please try again."
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="profile-state">
          <Spinner center label="Loading profile" />
        </div>
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
  const roleContext = isStudent ? profile.branch : profile.department;

  return (
    <>
      <Navbar />

      <div className="profile">
        <div className="profile-body">
          {/* Hero */}
          <div className="oq-card profile-hero">
            <div className="profile-avatar">
              <Avatar name={profile.name} image={profile.profileImage} size={96} />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={handleImagePick}
              />
              <div className="profile-avatar-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                >
                  {uploadingImage
                    ? "Working…"
                    : profile.profileImage
                    ? "Change"
                    : "Add photo"}
                </Button>
                {profile.profileImage && !uploadingImage && (
                  <Button
                    type="button"
                    variant="text"
                    size="sm"
                    className="profile-avatar-remove"
                    onClick={handleRemoveImage}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <div className="profile-identity">
              <h1 className="profile-name">{displayName}</h1>
              <div className="profile-role">
                <span className="profile-role-badge">{profile.role}</span>
                {roleContext && <span className="profile-role-sub">{roleContext}</span>}
              </div>

              <div className="profile-completion">
                <div className="profile-completion-head">
                  <span>Profile completion</span>
                  <span className="profile-completion-pct">{completion}%</span>
                </div>
                <ProgressBar
                  value={completion}
                  label="Profile completion"
                  className="profile-progress"
                />
              </div>
            </div>

            <div className="profile-actions">
              {editMode ? (
                <>
                  <Button variant="primary" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="primary" onClick={handleEdit}>
                  Edit profile
                </Button>
              )}
            </div>
          </div>

          {/* About */}
          <section className="oq-card profile-section">
            <h2 className="profile-section-title">About</h2>
            {editMode ? (
              <>
                <textarea
                  className="field-control"
                  name="bio"
                  value={current.bio || ""}
                  onChange={handleChange}
                  maxLength={BIO_MAX_LENGTH}
                  rows={4}
                  placeholder={
                    isStudent
                      ? "A short introduction about yourself, your interests and goals."
                      : "Tell students about your research interests, expertise and academic journey."
                  }
                />
                <div
                  className={`profile-counter${
                    (current.bio || "").length >= BIO_MAX_LENGTH ? " at-limit" : ""
                  }`}
                >
                  {(current.bio || "").length}/{BIO_MAX_LENGTH}
                </div>
              </>
            ) : (
              <p className="profile-bio">{profile.bio || "No bio added yet."}</p>
            )}
          </section>

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
        <section className="oq-card profile-section">
          <h3 className="profile-section-title">Professional information</h3>

          <ProfileField label="Title" value={profile.prefix} editMode={editMode}>
            <select
              className="field-control"
              name="prefix"
              value={current.prefix || ""}
              onChange={handleChange}
            >
              <option value="">None</option>
              <option value="Dr.">Dr.</option>
              <option value="Prof.">Prof.</option>
            </select>
          </ProfileField>

          <ProfileField label="Full name" value={profile.name} editMode={editMode}>
            <input
              className="field-control"
              name="name"
              value={current.name || ""}
              onChange={handleChange}
            />
          </ProfileField>

          <ProfileField
            label="Department"
            value={profile.department}
            editMode={editMode}
          >
            <input
              className="field-control"
              name="department"
              value={current.department || ""}
              onChange={handleChange}
              placeholder="e.g. DCSE"
            />
          </ProfileField>

          <ProfileField
            label="Designation"
            value={profile.designation}
            editMode={editMode}
          >
            <input
              className="field-control"
              name="designation"
              value={current.designation || ""}
              onChange={handleChange}
              placeholder="e.g. Assistant Professor"
            />
          </ProfileField>

          <ProfileField
            label="Cabin / office"
            value={profile.office}
            editMode={editMode}
          >
            <input
              className="field-control"
              name="office"
              value={current.office || ""}
              onChange={handleChange}
              placeholder="e.g. Cabin G-204, CSED Block"
            />
          </ProfileField>

          <ProfileField
            label="Research interests"
            value={profile.interests}
            editMode={editMode}
          >
            <input
              className="field-control"
              name="interests"
              value={current.interests || ""}
              onChange={handleChange}
              placeholder="e.g. Machine Learning, IoT"
            />
          </ProfileField>
        </section>

        {renderContactCard()}
      </div>
    );
  }

  // ── Student layout ──
  function renderStudent() {
    const skills = current.skills || [];
    const projects = [0, 1].map((i) => current.projects?.[i] || EMPTY_PROJECT);
    const suggestedPosition = current.year ? POSITION_BY_YEAR[current.year] : "";

    return (
      <>
        <div className="profile-grid">
          <section className="oq-card profile-section">
            <h3 className="profile-section-title">Academic details</h3>

            <ProfileField label="Full name" value={profile.name} editMode={editMode}>
              <input
                className="field-control"
                name="name"
                value={current.name || ""}
                onChange={handleChange}
              />
            </ProfileField>

            <ProfileField label="Branch" value={profile.branch} editMode={editMode}>
              <select
                className="field-control"
                name="branch"
                value={current.branch || ""}
                onChange={handleChange}
              >
                <option value="">Select branch</option>
                {BRANCH_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </ProfileField>

            <ProfileField
              label="Year"
              value={profile.year ? `Year ${profile.year}` : ""}
              editMode={editMode}
            >
              <select
                className="field-control"
                name="year"
                value={current.year || ""}
                onChange={handleChange}
              >
                <option value="">Select year</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </ProfileField>
          </section>

          {renderContactCard()}
        </div>

        {/* Skills */}
        <section className="oq-card profile-section">
          <h3 className="profile-section-title">Top skills</h3>
          {editMode && (
            <div className="profile-skill-picker">
              <select
                className="field-control"
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
              <span className="profile-hint">Choose up to {MAX_SKILLS}.</span>
            </div>
          )}
          <div className="profile-chips">
            {skills.length === 0 && (
              <span className="pf-empty">No skills added.</span>
            )}
            {skills.map((s) => (
              <span className="profile-chip" key={s}>
                {s}
                {editMode && (
                  <button
                    type="button"
                    aria-label={`Remove ${s}`}
                    onClick={() => removeSkill(s)}
                  >
                    <IconX />
                  </button>
                )}
              </span>
            ))}
          </div>
        </section>

        {/* Society */}
        <section className="oq-card profile-section">
          <h3 className="profile-section-title">Society / club</h3>
          {Number(current.year) === 4 && editMode && (
            <p className="profile-hint profile-hint-block">
              Final-year students are usually not active society members.
            </p>
          )}
          <div className="profile-two-col">
            <ProfileField
              label="Society / club"
              value={profile.society?.name}
              editMode={editMode}
            >
              <input
                className="field-control"
                value={current.society?.name || ""}
                onChange={(e) => setSociety("name", e.target.value)}
                placeholder="e.g. ACM Student Chapter"
              />
            </ProfileField>
            <ProfileField
              label="Position"
              value={profile.society?.position}
              editMode={editMode}
            >
              <select
                className="field-control"
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
            </ProfileField>
          </div>
        </section>

        {/* Projects */}
        <section className="oq-card profile-section">
          <h3 className="profile-section-title">Projects</h3>
          {!editMode && projects.every((p) => !p.title) && (
            <span className="pf-empty">No projects added.</span>
          )}
          {projects.map((p, i) =>
            editMode || p.title ? (
              <div className="profile-project" key={i}>
                <ProfileField
                  label={`Project ${i + 1}`}
                  value={p.title}
                  editMode={editMode}
                >
                  <input
                    className="field-control"
                    value={p.title || ""}
                    onChange={(e) => setProject(i, "title", e.target.value)}
                    placeholder="Project title"
                  />
                </ProfileField>
                {editMode ? (
                  <textarea
                    className="field-control"
                    value={p.description || ""}
                    onChange={(e) => setProject(i, "description", e.target.value)}
                    placeholder="What it does, your role, the stack."
                    rows={2}
                  />
                ) : (
                  p.description && (
                    <p className="profile-project-desc">{p.description}</p>
                  )
                )}
              </div>
            ) : null
          )}
        </section>

        {/* Interests */}
        <section className="oq-card profile-section">
          <h3 className="profile-section-title">Areas of interest</h3>
          {editMode ? (
            <input
              className="field-control"
              name="interests"
              value={current.interests || ""}
              onChange={handleChange}
              placeholder="e.g. Backend engineering, Competitive programming"
            />
          ) : (
            <p className="profile-bio">{profile.interests || "Not specified."}</p>
          )}
        </section>
      </>
    );
  }

  function renderContactCard() {
    const linkedin = profile.linkedinUrl ? (
      <a href={profile.linkedinUrl} target="_blank" rel="noreferrer">
        {profile.linkedinUrl}
      </a>
    ) : (
      ""
    );

    return (
      <section className="oq-card profile-section">
        <h3 className="profile-section-title">Contact &amp; links</h3>
        <ProfileField label="Email" value={profile.email} />
        <ProfileField label="LinkedIn" value={linkedin} editMode={editMode}>
          <input
            className="field-control"
            name="linkedinUrl"
            value={current.linkedinUrl || ""}
            onChange={handleChange}
            placeholder="https://linkedin.com/in/yourname"
          />
        </ProfileField>
      </section>
    );
  }
}

export default Profile;
