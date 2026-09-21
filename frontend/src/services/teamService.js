import { apiRequest } from "./api";

export async function getTeams() {
  return apiRequest("/teams");
}

export async function getTeamById(teamId) {
  return apiRequest(`/teams/${teamId}`);
}

export async function createTeam(teamData) {
  return apiRequest("/teams", {
    method: "POST",
    body: JSON.stringify(teamData),
  });
}

export async function updateTeam(teamId, teamData) {
  return apiRequest(`/teams/${teamId}`, {
    method: "PUT",
    body: JSON.stringify(teamData),
  });
}

export async function deleteTeam(teamId) {
  return apiRequest(`/teams/${teamId}`, {
    method: "DELETE",
  });
}

export async function getTeamMembers(teamId) {
  return apiRequest(`/teams/${teamId}/members`);
}

export async function addTeamMember(teamId, userId) {
  return apiRequest(`/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify({
      userId,
    }),
  });
}

export async function removeTeamMember(teamId, userId) {
  return apiRequest(`/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
  });
}
