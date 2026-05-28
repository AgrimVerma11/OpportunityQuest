const API_BASE = "http://localhost:5174/api";

// GET with token
export const fetchWithAuth = async (endpoint) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
};

// POST with token
export const postWithAuth = async (endpoint, data) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return res.json();
};

// PUBLIC GET
export const fetchPublic = async (endpoint) => {
  const res = await fetch(`${API_BASE}${endpoint}`);
  return res.json();
};