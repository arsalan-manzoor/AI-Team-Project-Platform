// ============================================================
// ZYRA API CONFIGURATION
// ============================================================

const API_BASE_URL = "/api";

const AUTH_CHANGE_EVENT = "zyra-auth-changed";

const ACTIVE_WORKSPACE_KEY = "zyra_active_workspace_id";

const ACTIVE_WORKSPACE_ROLE_PREFIX = "zyra_active_workspace_role_";

// ============================================================
// API REQUEST
// ============================================================

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("zyra_token");

  const headers = {
    ...(options.headers || {}),
  };

  // ----------------------------------------------------------
  // CONTENT TYPE
  // ----------------------------------------------------------

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  } else {
    delete headers["Content-Type"];
  }

  // ----------------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------------

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    delete headers.Authorization;
  }

  // ----------------------------------------------------------
  // ACTIVE WORKSPACE CONTEXT
  // ----------------------------------------------------------

  const activeWorkspaceId = localStorage.getItem(ACTIVE_WORKSPACE_KEY)?.trim();

  if (activeWorkspaceId) {
    headers["X-Zyra-Workspace-Id"] = activeWorkspaceId;

    const selectedRole = localStorage
      .getItem(`${ACTIVE_WORKSPACE_ROLE_PREFIX}${activeWorkspaceId}`)
      ?.trim()
      .toUpperCase();

    if (selectedRole) {
      headers["X-Zyra-Workspace-Role"] = selectedRole;
    } else {
      delete headers["X-Zyra-Workspace-Role"];
    }
  } else {
    delete headers["X-Zyra-Workspace-Id"];
    delete headers["X-Zyra-Workspace-Role"];
  }

  // ----------------------------------------------------------
  // SEND REQUEST
  // ----------------------------------------------------------

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (error) {
    console.error("ZYRA API connection error:", error);

    throw new Error(
      `Cannot connect to the ZYRA backend at ${API_BASE_URL}. ` +
        "Make sure the backend is running with npmstart.",
    );
  }

  // ----------------------------------------------------------
  // PARSE RESPONSE
  // ----------------------------------------------------------

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  // ----------------------------------------------------------
  // ERROR HANDLING
  // ----------------------------------------------------------

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}`;

    const error = new Error(message);

    // Preserve the HTTP status for authentication handling.
    error.status = response.status;

    // Preserve the backend error response.
    error.data = data;

    throw error;
  }

  return data;
}

// ============================================================
// AUTHENTICATION TOKEN
// ============================================================

export function setAuthToken(token) {
  if (!token) {
    return;
  }

  localStorage.setItem("zyra_token", token);

  // Notify WorkspaceContext that authentication has changed.

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
}

export function getAuthToken() {
  return localStorage.getItem("zyra_token");
}

export function clearAuthToken() {
  localStorage.removeItem("zyra_token");

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
}
