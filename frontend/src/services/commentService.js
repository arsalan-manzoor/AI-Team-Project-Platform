import { apiRequest } from "./api";

export async function getTaskComments(taskId) {
  return apiRequest(`/comments/task/${taskId}`);
}

export async function getProjectComments(projectId) {
  return apiRequest(`/comments/project/${projectId}`);
}

export async function createComment(commentData) {
  return apiRequest("/comments", {
    method: "POST",
    body: JSON.stringify(commentData),
  });
}

export async function updateComment(commentId, commentData) {
  return apiRequest(`/comments/${commentId}`, {
    method: "PUT",
    body: JSON.stringify(commentData),
  });
}

export async function deleteComment(commentId) {
  return apiRequest(`/comments/${commentId}`, {
    method: "DELETE",
  });
}
