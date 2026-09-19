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
