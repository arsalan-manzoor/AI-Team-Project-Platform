import { apiRequest } from "./api";

export async function getProjects() {
  return apiRequest("/projects");
}

export async function getProjectById(projectId) {
  return apiRequest(`/projects/${projectId}`);
}

export async function createProject(projectData) {
  return apiRequest("/projects", {
    method: "POST",
    body: JSON.stringify(projectData),
  });
}

export async function updateProject(projectId, projectData) {
  return apiRequest(`/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(projectData),
  });
}

export async function deleteProject(projectId) {
  return apiRequest(`/projects/${projectId}`, {
    method: "DELETE",
  });
}
