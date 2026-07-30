import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { IconBell } from "./Icons";
import { fetchWithAuth, patchWithAuth } from "../utils/api";
import "./NotificationBell.css";

// Compact relative time: "just now", "5m", "3h", "2d", else a date.
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

const POLL_MS = 60000;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  const loadUnread = useCallback(async () => {
    try {
      const data = await fetchWithAuth("/notifications/unread-count");
      if (data?.success) setUnread(data.count);
    } catch {
      /* the badge is non-critical; ignore transient failures */
    }
  }, []);

  // Poll the unread count while mounted.
  useEffect(() => {
    loadUnread();
    const id = setInterval(loadUnread, POLL_MS);
    return () => clearInterval(id);
  }, [loadUnread]);

  // Dismiss on an outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true);
    try {
      const data = await fetchWithAuth("/notifications");
      if (data?.success) setItems(data.notifications);
    } catch {
      /* leave the list as-is on failure */
    } finally {
      setLoading(false);
    }
  };

  const openItem = (n) => {
    setOpen(false);
    if (!n.read) {
      setItems((prev) =>
        prev.map((x) => (x._id === n._id ? { ...x, read: true } : x))
      );
      setUnread((u) => Math.max(0, u - 1));
      patchWithAuth(`/notifications/${n._id}/read`).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const markAll = () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    patchWithAuth("/notifications/read-all").catch(() => {});
  };

  return (
    <div className="notif" ref={wrapRef}>
      <button
        type="button"
        className="notif-bell"
        onClick={toggle}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <IconBell />
        {unread > 0 && (
          <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <span>Notifications</span>
            {unread > 0 && (
              <button type="button" className="notif-markall" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {loading ? (
              <div className="notif-empty">Loading…</div>
            ) : items.length === 0 ? (
              <div className="notif-empty">You&rsquo;re all caught up.</div>
            ) : (
              items.map((n) => (
                <button
                  type="button"
                  key={n._id}
                  className={`notif-item${n.read ? "" : " unread"}`}
                  onClick={() => openItem(n)}
                >
                  <span className="notif-dot" aria-hidden="true" />
                  <span className="notif-content">
                    <span className="notif-title">{n.title}</span>
                    {n.body && <span className="notif-text">{n.body}</span>}
                    <span className="notif-time">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
