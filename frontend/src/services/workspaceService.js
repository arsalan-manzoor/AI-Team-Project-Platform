import { apiRequest } from "./api";

/**
 * Get all workspaces available to the currently authenticated user.
 *
 * Each workspace contains its own role:
 * ADMIN, HR, TEAM_LEADER, or USER.
 */
export async function getMyWorkspaces() {
  return apiRequest("/workspaces/mine");
}

/**
 * Get members of a specific workspace.
 *
 * @param {number|string} workspaceId
 */
export async function getWorkspaceMembers(workspaceId) {
  if (!workspaceId) {
    throw new Error("Workspace ID is required.");
  }

  return apiRequest(`/workspaces/${workspaceId}/members`);
}
