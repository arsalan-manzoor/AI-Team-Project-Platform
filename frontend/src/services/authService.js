import {
  apiRequest,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
} from "./api";

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

export async function getCurrentUser() {
  return apiRequest("/auth/me");
}

export function logout() {
  clearAuthToken();
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}