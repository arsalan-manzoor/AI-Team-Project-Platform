import { apiRequest, setAuthToken, clearAuthToken, getAuthToken } from "./api";

// ======================================================
// ZYRA AUTHENTICATION STORAGE
// ======================================================

const ACTIVE_WORKSPACE_KEY = "zyra_active_workspace_id";

const AUTH_PORTAL_KEY = "zyra_auth_portal";

// ======================================================
// LOGIN
// ======================================================

export async function login(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (data.token) {
    setAuthToken(data.token);
  }

  return data;
}

// ======================================================
// CURRENT USER
// ======================================================

export async function getCurrentUser() {
  return apiRequest("/auth/me");
}

// ======================================================
// PORTAL MANAGEMENT
// ======================================================

export function setAuthPortal(portal) {
  const normalizedPortal = String(portal || "")
    .trim()
    .toUpperCase();

  if (!["INDIVIDUAL", "COMPANY"].includes(normalizedPortal)) {
    return;
  }

  sessionStorage.setItem(AUTH_PORTAL_KEY, normalizedPortal);
}

export function getAuthPortal() {
  return sessionStorage.getItem(AUTH_PORTAL_KEY);
}

// ======================================================
// LOGOUT
// ======================================================

export function logout() {
  // Capture the portal before clearing authentication.
  const previousPortal = getAuthPortal();

  // Clear authentication.
  clearAuthToken();

  // Clear the active workspace.
  localStorage.removeItem(ACTIVE_WORKSPACE_KEY);

  // Clear dashboard navigation history.
  sessionStorage.removeItem("zyra_last_dashboard_path");

  // Clear the saved portal session.
  sessionStorage.removeItem(AUTH_PORTAL_KEY);

  return previousPortal;
}

// ======================================================
// AUTHENTICATION STATUS
// ======================================================

export function isAuthenticated() {
  return Boolean(getAuthToken());
}
