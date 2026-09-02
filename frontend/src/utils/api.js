const API_BASE = import.meta.env.VITE_API_URL;

export const BACKEND_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5174/api"
).replace("/api", "");

// Resolves a stored public-file reference to a usable URL. In production these
// are absolute URLs (an object-storage/CDN address) and are used as-is; in local
// development they are paths relative to the backend and get its origin prefixed.
export const fileUrl = (value) => {
  if (!value) return value;
  return /^https?:\/\//i.test(value) ? value : `${BACKEND_URL}${value}`;
};

const authHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// A 401 from an authenticated request means the session is missing or expired.
// Clear the stale session and send the user back to the login screen, rather
// than letting the page silently render empty.
const handleUnauthorized = (res) => {
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("isLoggedIn");
    if (window.location.pathname !== "/") {
      window.location.href = "/";
    }
  }
  return res;
};

// GET with token
export const fetchWithAuth = async (endpoint) => {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { ...authHeader() },
  });
  handleUnauthorized(res);
  return res.json();
};

// POST with token
export const postWithAuth = async (endpoint, data) => {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(data),
  });
  handleUnauthorized(res);
  return res.json();
};

// PUBLIC GET — no token, so no session handling.
export const fetchPublic = async (endpoint) => {
  const res = await fetch(`${API_BASE}${endpoint}`);
  return res.json();
};

// PUBLIC POST — no token (e.g. Google sign-in / onboarding).
export const postPublic = async (endpoint, data) => {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
};

// PATCH with token
export const patchWithAuth = async (endpoint, data = {}) => {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(data),
  });
  handleUnauthorized(res);
  return res.json();
};

// DELETE with token. `data`, if provided, is sent as a JSON body (e.g. a
// required moderation reason) — omitted entirely for existing callers that
// pass none, so their request is byte-for-byte unchanged.
export const deleteWithAuth = async (endpoint, data) => {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "DELETE",
    headers: {
      ...authHeader(),
      ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  handleUnauthorized(res);
  return res.json();
};

// MULTIPART UPLOAD with token — do NOT set Content-Type manually; the browser
// sets the multipart boundary.
export const uploadWithAuth = async (endpoint, formData) => {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { ...authHeader() },
    body: formData,
  });
  handleUnauthorized(res);
  return res.json();
};

// PUT with token
export const putWithAuth = async (endpoint, data) => {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(data),
  });
  handleUnauthorized(res);
  return res.json();
};

// Open a protected file (e.g. a resume) in a new tab. The route needs the auth
// header, so we fetch it as a blob rather than linking to it directly.
export const openAuthedFile = async (endpoint) => {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { ...authHeader() },
  });

  if (!res.ok) {
    handleUnauthorized(res);
    let message = "Unable to open file";
    try {
      const data = await res.json();
      message = data.message || message;
    } catch {
      /* response was not JSON */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};
