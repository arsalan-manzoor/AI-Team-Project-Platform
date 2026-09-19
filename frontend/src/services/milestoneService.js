import { apiRequest } from "./api";

export async function getProjectMilestones(projectId) {
  return apiRequest(`/milestones/project/${projectId}`);
}

export async function createMilestone(milestoneData) {
  return apiRequest("/milestones", {
    method: "POST",
    body: JSON.stringify(milestoneData),
  });
}

export async function updateMilestone(milestoneId, milestoneData) {
  return apiRequest(`/milestones/${milestoneId}`, {
    method: "PUT",
    body: JSON.stringify(milestoneData),
  });
}

export async function deleteMilestone(milestoneId) {
  return apiRequest(`/milestones/${milestoneId}`, {
    method: "DELETE",
  });
}
