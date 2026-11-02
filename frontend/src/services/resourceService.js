import { apiRequest } from "./api";

export async function getProjectResources(projectId) {
  return apiRequest(`/resources/project/${projectId}`);
}

export async function createResource(resourceData) {
  const formData = new FormData();

  formData.append("name", resourceData.name);
  formData.append("description", resourceData.description || "");
  formData.append("projectId", resourceData.projectId);

  if (resourceData.url) {
    formData.append("url", resourceData.url);
  }

  if (resourceData.file) {
    formData.append("file", resourceData.file);
  }

  return apiRequest("/resources", {
    method: "POST",
    body: formData,
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
