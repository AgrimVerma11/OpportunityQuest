import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Navbar from "./Navbar";
import Avatar from "../components/Avatar";
import Button from "../components/Button";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { useConfirm } from "../components/ConfirmProvider";
import { useToast } from "../components/ToastProvider";
import { IconArrowLeft, IconInbox, IconAlert, IconTrash } from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import { fetchWithAuth, postWithAuth, deleteWithAuth } from "../utils/api";
import "./Messages.css";

// Compact relative time for the inbox list: "just now", "5m", "3h", "2d", else a date.
function timeShort(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function sameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// Clock time on a message bubble, e.g. "3:45 PM".
function messageTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Exact date + time for the hover tooltip, e.g. "6 Aug 2026, 3:45 pm".
function fullTimestamp(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Day-divider label between messages: "Today" / "Yesterday" / a full date.
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const THREAD_POLL_MS = 12000;

export default function Messages() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();

  const [conversations, setConversations] = useState([]);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const loadInbox = useCallback(async () => {
    try {
      const data = await fetchWithAuth("/conversations");
      if (data?.success) setConversations(data.conversations);
    } catch {
      /* inbox is best-effort */
    }
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const loadThread = useCallback(async () => {
    if (!id) {
      setThread(null);
      return;
    }
    try {
      const data = await fetchWithAuth(`/conversations/${id}`);
      if (data?.success) {
        setThread({
          conversation: data.conversation,
          messages: data.messages,
          canSend: data.canSend,
        });
        // Opening a thread clears its unread on the server; mirror that here.
        setConversations((prev) =>
          prev.map((c) => (c._id === id ? { ...c, unread: 0 } : c))
        );
      } else {
        setThread(null);
      }
    } catch {
      setThread(null);
    }
  }, [id]);

  useEffect(() => {
    setThreadLoading(true);
    loadThread().finally(() => setThreadLoading(false));
  }, [loadThread]);

  // Poll the open thread so new messages appear without a manual refresh.
  useEffect(() => {
    if (!id) return undefined;
    const t = setInterval(loadThread, THREAD_POLL_MS);
    return () => clearInterval(t);
  }, [id, loadThread]);

  // Keep the latest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages?.length]);

  const send = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const data = await postWithAuth(`/conversations/${id}/messages`, { body });
      if (data?.success) {
        setThread((t) =>
          t ? { ...t, messages: [...t.messages, data.message] } : t
        );
        setDraft("");
        loadInbox();
      } else {
        toast.error(data?.message || "Could not send the message.");
      }
    } catch {
      toast.error("Could not send the message.");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete this conversation?",
      message:
        "This permanently deletes the conversation and all its messages for both people. This can't be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const data = await deleteWithAuth(`/conversations/${id}`);
      if (data?.success) {
        setConversations((prev) => prev.filter((c) => c._id !== id));
        setThread(null);
        navigate("/messages");
        toast.success("Conversation deleted.");
      } else {
        toast.error(data?.message || "Could not delete the conversation.");
      }
    } catch {
      toast.error("Could not delete the conversation.");
    }
  };

  const counterpart = (conversation) => {
    if (!conversation) return null;
    const s = conversation.student;
    const f = conversation.faculty;
    return s?._id === user?.id ? f : s;
  };

  const other = thread ? counterpart(thread.conversation) : null;

  return (
    <>
      <Navbar />
      <div className="msg-container">
        <div className={`msg-shell${id ? " has-thread" : ""}`}>
          {/* INBOX */}
          <aside className="msg-inbox">
            <div className="msg-inbox-head">Messages</div>
            {conversations.length === 0 ? (
              <div className="msg-inbox-empty">No conversations yet.</div>
            ) : (
              <ul className="msg-inbox-list">
                {conversations.map((c) => (
                  <li key={c._id}>
                    <button
                      type="button"
                      className={`msg-inbox-item${c._id === id ? " active" : ""}`}
                      onClick={() => navigate(`/messages/${c._id}`)}
                    >
                      <Avatar
                        name={c.counterpart?.name}
                        image={c.counterpart?.profileImage}
                        size={40}
                      />
                      <span className="msg-inbox-text">
                        <span className="msg-inbox-name">
                          {c.counterpart?.prefix ? `${c.counterpart.prefix} ` : ""}
                          {c.counterpart?.name || "Unknown"}
                          {c.unread > 0 && <span className="msg-unread-dot" />}
                        </span>
                        <span className="msg-inbox-title">
                          {c.opportunityTitle}
                        </span>
                        <span className="msg-inbox-snippet">
                          {c.lastMessageSnippet}
                        </span>
                      </span>
                      <span
                        className="msg-inbox-time"
                        title={fullTimestamp(c.lastMessageAt)}
                      >
                        {timeShort(c.lastMessageAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* THREAD */}
          <section className="msg-thread">
            {!id ? (
              <div className="msg-thread-empty">
                <EmptyState
                  icon={<IconInbox />}
                  title="No conversation selected"
                  description="Choose a conversation from the list to read and reply."
                />
              </div>
            ) : threadLoading && !thread ? (
              <div className="msg-thread-empty">
                <Spinner center label="Loading conversation" />
              </div>
            ) : !thread ? (
              <div className="msg-thread-empty">
                <EmptyState
                  icon={<IconAlert />}
                  title="Conversation not found"
                  description="This conversation may have been removed."
                />
              </div>
            ) : (
              <>
                <header className="msg-thread-head">
                  <button
                    type="button"
                    className="msg-back"
                    onClick={() => navigate("/messages")}
                    aria-label="Back to conversations"
                  >
                    <IconArrowLeft />
                  </button>
                  <Avatar
                    name={other?.name}
                    image={other?.profileImage}
                    size={36}
                  />
                  <div className="msg-thread-who">
                    <span className="msg-thread-name">
                      {other?.prefix ? `${other.prefix} ` : ""}
                      {other?.name || "Unknown"}
                    </span>
                    <span className="msg-thread-sub">
                      {thread.conversation.opportunityTitle}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="msg-delete"
                    onClick={handleDelete}
                    aria-label="Delete conversation"
                  >
                    <IconTrash />
                  </button>
                </header>

                <div className="msg-messages">
                  {thread.messages.map((m, i) => {
                    const prev = thread.messages[i - 1];
                    const showDay =
                      !prev || !sameDay(prev.createdAt, m.createdAt);
                    return (
                      <Fragment key={m._id}>
                        {showDay && (
                          <div className="msg-day">
                            <span>{dayLabel(m.createdAt)}</span>
                          </div>
                        )}
                        <div
                          className={`msg-bubble-row${
                            m.sender === user?.id ? " mine" : ""
                          }`}
                        >
                          <div className="msg-bubble">
                            <span className="msg-bubble-body">{m.body}</span>
                            <span
                              className="msg-bubble-time"
                              title={fullTimestamp(m.createdAt)}
                            >
                              {messageTime(m.createdAt)}
                            </span>
                          </div>
                        </div>
                      </Fragment>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                {thread.canSend ? (
                  <form className="msg-composer" onSubmit={send}>
                    <textarea
                      className="msg-input"
                      placeholder="Write a message…"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send(e);
                        }
                      }}
                      rows={1}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      type="submit"
                      disabled={sending || !draft.trim()}
                    >
                      Send
                    </Button>
                  </form>
                ) : (
                  <div className="msg-readonly">
                    This conversation is read-only.
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
