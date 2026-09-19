import { apiRequest } from "./api";

export async function getProjectResources(projectId) {
  return apiRequest(`/resources/project/${projectId}`);
}

export async function createResource(resourceData) {
  return apiRequest("/resources", {
    method: "POST",
    body: JSON.stringify(resourceData),
  });
}

export async function updateResource(resourceId, resourceData) {
  return apiRequest(`/resources/${resourceId}`, {
    method: "PUT",
    body: JSON.stringify(resourceData),
  });
}

export async function deleteResource(resourceId) {
  return apiRequest(`/resources/${resourceId}`, {
    method: "DELETE",
  });
}
