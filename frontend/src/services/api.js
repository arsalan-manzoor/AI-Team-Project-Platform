const API_BASE_URL = "http://localhost:5000/api";

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("zyra_token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data;
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem("zyra_token", token);
  }
}

export function getAuthToken() {
  return localStorage.getItem("zyra_token");
}

export function clearAuthToken() {
  localStorage.removeItem("zyra_token");
}
