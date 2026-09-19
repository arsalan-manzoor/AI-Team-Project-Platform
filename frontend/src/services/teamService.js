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

export async function getTeamMembers(teamId) {
  return apiRequest(`/teams/${teamId}/members`);
}
