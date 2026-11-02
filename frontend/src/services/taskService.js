import { apiRequest } from "./api";

export async function getTasks() {
  return apiRequest("/tasks");
}

export async function getTaskById(taskId) {
  return apiRequest(`/tasks/${taskId}`);
}

export async function getProjectTasks(projectId) {
  const tasks = await apiRequest("/tasks");

  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks.filter((task) => Number(task.project_id) === Number(projectId));
}

export async function createTask(taskData) {
  return apiRequest("/tasks", {
    method: "POST",
    body: JSON.stringify(taskData),
  });
}

export async function updateTask(taskId, taskData) {
  return apiRequest(`/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(taskData),
  });
}

export async function deleteTask(taskId) {
  return apiRequest(`/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export async function getTaskSubtasks(taskId) {
  return apiRequest(`/subtasks/task/${taskId}`);
}

export async function createSubtask(subtaskData) {
  return apiRequest("/subtasks", {
    method: "POST",
    body: JSON.stringify(subtaskData),
  });
}

export async function updateSubtask(subtaskId, subtaskData) {
  return apiRequest(`/subtasks/${subtaskId}`, {
    method: "PUT",
    body: JSON.stringify(subtaskData),
  });
}

export async function deleteSubtask(subtaskId) {
  return apiRequest(`/subtasks/${subtaskId}`, {
    method: "DELETE",
  });
}
