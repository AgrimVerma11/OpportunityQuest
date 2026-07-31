import { useEffect, useState } from "react";

import Modal from "./Modal";
import ProfileView from "./ProfileView";
import Spinner from "./Spinner";
import { fetchWithAuth } from "../utils/api";

// Fetches a user's public profile by id and shows it in the shared modal.
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
    <Modal open onClose={onClose} title="Profile" size="md">
      {loading ? (
        <Spinner center label="Loading profile" />
      ) : profile ? (
        <ProfileView profile={profile} />
      ) : (
        <p className="pv-unavailable">Profile unavailable.</p>
      )}
    </Modal>
  );
}
