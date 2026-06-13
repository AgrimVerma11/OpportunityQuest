import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";
import ProfileView from "./ProfileView";
import "./ProfileModal.css";

// Fetches a user's public profile by id and shows it in a modal.
export default function ProfileModal({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchWithAuth(`/users/${userId}`);
        if (active && res.success) setProfile(res.profile);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-card profile-modal-card">
        {loading ? (
          <p className="pv-loading">Loading…</p>
        ) : profile ? (
          <ProfileView profile={profile} />
        ) : (
          <p className="pv-loading">Profile unavailable.</p>
        )}
        <button className="btn btn-secondary btn-sm pv-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
