import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "./Navbar";

import {
  fetchWithAuth,
  putWithAuth,
} from "../utils/api";

import "./Profile.css";

function Profile() {

  const navigate = useNavigate();

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [editMode, setEditMode] =
    useState(false);

  const [profile, setProfile] =
    useState(null);

  const [saveError, setSaveError] =
    useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }
    loadProfile();
  }, [navigate]);

  const loadProfile =
    async () => {

      try {

        const data =
          await fetchWithAuth(
            "/auth/profile"
          );

        if (data.success) {

          setProfile(
            data.profile
          );
        }

      } catch (error) {

        console.error(error);

      } finally {

        setLoading(false);
      }
    };

  const handleChange = (e) => {

    setProfile({
      ...profile,
      [e.target.name]:
        e.target.value,
    });
  };

  const handleSave =
    async () => {

      try {

        setSaving(true);

        const payload = {

          name:
            profile.name,

          department:
            profile.department,

          designation:
            profile.designation,

          interests:
            profile.interests,

          bio:
            profile.bio,

          linkedinUrl:
            profile.linkedinUrl,
        };

        const result =
          await putWithAuth(
            "/auth/profile",
            payload
          );

        if (result.success) {

          setProfile(
            result.profile
          );

          setEditMode(false);

          setSaveError("");

          alert(
            "Profile updated successfully."
          );

        } else {

          setSaveError(
            result.message ||
            "Failed to save profile. Please try again."
          );

        }

      } catch (error) {

        console.error(error);

        setSaveError(
          "Something went wrong. Please try again."
        );

      } finally {

        setSaving(false);
      }
    };

  if (loading) {

    return (
      <>
        <Navbar />

        <div className="profile-loading">
          Loading profile...
        </div>
      </>
    );
  }

  const profileFields = [

    profile?.bio,

    profile?.department,

    profile?.designation,

    profile?.interests,

    profile?.linkedinUrl,
  ];

  const completedFields =
    profileFields.filter(
      (field) =>
        field &&
        field.toString().trim() !== ""
    ).length;

  const completion =
    Math.round(
      (
        completedFields /
        profileFields.length
      ) * 100
    );

  return (
    <>
      <Navbar />

      <div className="profile-container">

        {/* HERO */}

        <div className="profile-hero">

          <div className="profile-avatar-large">

            {profile?.name
              ?.charAt(0)
              ?.toUpperCase()}

          </div>

          <h1>
            {profile.name}
          </h1>

          <p className="profile-role">

            {profile.role}

            {profile.department
              ? ` • ${profile.department}`
              : ""}

          </p>

          <div className="completion-wrapper">

            <span>
              Profile Completion
            </span>

            <div className="progress-bar">

              <div
                className="progress-fill"
                style={{
                  width:
                    `${completion}%`,
                }}
              />

            </div>

            <span>
              {completion}%
            </span>

          </div>

          {saveError && (
            <p className="error-text" style={{ color: "red", marginBottom: "8px" }}>
              {saveError}
            </p>
          )}

          <button
            className="edit-btn"
            onClick={() => {
              if (editMode) {
                handleSave();
              } else {
                setSaveError("");
                setEditMode(true);
              }
            }}
            disabled={saving}
          >

            {editMode

              ? (
                saving
                  ? "Saving..."
                  : "Save Changes"
              )

              : "Edit Profile"}

          </button>

        </div>

        {/* ABOUT */}

        <div className="profile-section">

          <h2>
            About Me
          </h2>

          {editMode ? (

            <textarea
              rows="5"
              name="bio"
              value={
                profile.bio || ""
              }
              onChange={
                handleChange
              }
            />

          ) : (

            <p>

              {profile.bio ||

                "Tell students about your research interests, expertise and academic journey."}

            </p>

          )}

        </div>

        {/* INFORMATION */}

        <div className="profile-grid">

          <div className="profile-info-card">

            <h3>
              Professional Information
            </h3>

            <label>
              Name
            </label>

            <input
              name="name"
              value={
                profile.name || ""
              }
              disabled={!editMode}
              onChange={
                handleChange
              }
            />

            <label>
              Department
            </label>

            <input
              name="department"
              value={
                profile.department || ""
              }
              disabled={!editMode}
              onChange={
                handleChange
              }
            />

            <label>
              Designation
            </label>

            <input
              name="designation"
              value={
                profile.designation || ""
              }
              disabled={!editMode}
              onChange={
                handleChange
              }
            />

            <label>
              Interests
            </label>

            <input
              name="interests"
              value={
                profile.interests || ""
              }
              disabled={!editMode}
              onChange={
                handleChange
              }
            />

          </div>

          <div className="profile-info-card">

            <h3>
              Contact & Links
            </h3>

            <label>
              Email
            </label>

            <input
              value={
                profile.email || ""
              }
              disabled
            />

            <label>
              LinkedIn
            </label>

            <input
              name="linkedinUrl"
              value={
                profile.linkedinUrl || ""
              }
              disabled={!editMode}
              onChange={
                handleChange
              }
            />

          </div>

        </div>

      </div>
    </>
  );
}

export default Profile;