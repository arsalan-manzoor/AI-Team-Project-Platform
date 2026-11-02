import { apiRequest } from "./api";

export async function getNotifications() {
  return apiRequest("/notifications");
}

export async function getUnreadNotifications() {
  return apiRequest("/notifications/unread");
}

export async function markNotificationAsRead(notificationId) {
  return apiRequest(`/notifications/${notificationId}/read`, {
    method: "PUT",
  });
}

export async function markAllNotificationsAsRead() {
  return apiRequest("/notifications/read-all", {
    method: "PUT",
  });
}

// Delete one notification
export async function deleteNotification(notificationId) {
  return apiRequest(`/notifications/${notificationId}`, {
    method: "DELETE",
  });
}

// Delete all notifications
export async function deleteAllNotifications() {
  return apiRequest("/notifications/delete-all", {
    method: "DELETE",
  });
}
