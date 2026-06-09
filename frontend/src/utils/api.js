const API_BASE =
  import.meta.env.VITE_API_URL;

export const BACKEND_URL =
  (import.meta.env.VITE_API_URL || "http://localhost:5174/api").replace("/api", "");

// GET with token
export const fetchWithAuth = async (
  endpoint
) => {

  const token =
    localStorage.getItem("token");

  const res = await fetch(
    `${API_BASE}${endpoint}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.json();
};

// POST with token
export const postWithAuth = async (
  endpoint,
  data
) => {

  const token =
    localStorage.getItem("token");

  const res = await fetch(
    `${API_BASE}${endpoint}`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Authorization:
          `Bearer ${token}`,
      },

      body: JSON.stringify(data),
    }
  );

  return res.json();
};

// PUBLIC GET
export const fetchPublic = async (
  endpoint
) => {

  const res = await fetch(
    `${API_BASE}${endpoint}`
  );

  return res.json();
};

// PATCH with token
export const patchWithAuth = async (
  endpoint,
  data = {}
) => {

  const token =
    localStorage.getItem("token");

  const res = await fetch(
    `${API_BASE}${endpoint}`,
    {
      method: "PATCH",

      headers: {
        "Content-Type":
          "application/json",

        Authorization:
          `Bearer ${token}`,
      },

      body: JSON.stringify(data),
    }
  );

  return res.json();
};



// DELETE with token
export const deleteWithAuth = async (
  endpoint
) => {

  const token =
    localStorage.getItem("token");

  const res = await fetch(
    `${API_BASE}${endpoint}`,
    {
      method: "DELETE",

      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    }
  );

  return res.json();
};

// MULTIPART UPLOAD with token (for file uploads — do NOT set Content-Type manually)
export const uploadWithAuth = async (endpoint, formData) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  return res.json();
};

// PUT with token
export const putWithAuth = async (
  endpoint,
  data
) => {

  const token =
    localStorage.getItem("token");

  const res = await fetch(
    `${API_BASE}${endpoint}`,
    {
      method: "PUT",

      headers: {
        "Content-Type":
          "application/json",

        Authorization:
          `Bearer ${token}`,
      },

      body: JSON.stringify(data),
    }
  );

  return res.json();
};