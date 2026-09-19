const API_BASE_URL = "http://localhost:5000/api/users";

export async function getCurrentUser() {
  const response = await fetch(`${API_BASE_URL}/me`);

  if (!response.ok) {
    throw new Error("Failed to fetch current user");
  }

  return response.json();
}

export async function getUserById(userId) {
  const response = await fetch(`${API_BASE_URL}/${userId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }

  return response.json();
}

export async function getUsers() {
  const response = await fetch(API_BASE_URL);

  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }

  return response.json();
}
