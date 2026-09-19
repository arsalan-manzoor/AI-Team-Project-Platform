import { useEffect, useState } from "react";
import { Bell, CheckCheck, Clock3 } from "lucide-react";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../services/notificationService";

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");

      const data = await getNotifications();

      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleMarkAsRead(notificationId) {
    try {
      await markNotificationAsRead(notificationId);

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification,
        ),
      );
    } catch (err) {
      setError(err.message || "Failed to mark notification as read");
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await markAllNotificationsAsRead();

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          is_read: true,
        })),
      );
    } catch (err) {
      setError(err.message || "Failed to mark all notifications as read");
    }
  }

  const totalNotifications = notifications.length;

  const unreadNotifications = notifications.filter(
    (notification) => !notification.is_read,
  ).length;

  const recentActivity = notifications.filter(
    (notification) => notification.created_at,
  ).length;

  return (
    <div className="zyra-notifications">
      <div className="notifications-header">
        <div>
          <p className="notifications-eyebrow">ACTIVITY CENTER</p>

          <h2>Notifications</h2>

          <p className="notifications-subtitle">
            Stay updated with activity across your projects and teams.
          </p>
        </div>

        <button
          className="notifications-read-btn"
          onClick={handleMarkAllAsRead}
          disabled={unreadNotifications === 0}
        >
          <CheckCheck size={16} />
          Mark all as read
        </button>
      </div>

      {error && <div className="notifications-error">{error}</div>}

      <div className="notifications-summary">
        <div className="notification-summary-card">
          <div className="notification-summary-icon">
            <Bell size={19} />
          </div>

          <div>
            <span>Total Notifications</span>
            <strong>{loading ? "..." : totalNotifications}</strong>
          </div>
        </div>

        <div className="notification-summary-card">
          <div className="notification-summary-icon">
            <Bell size={19} />
          </div>

          <div>
            <span>Unread</span>
            <strong>{loading ? "..." : unreadNotifications}</strong>
          </div>
        </div>

        <div className="notification-summary-card">
          <div className="notification-summary-icon">
            <Clock3 size={19} />
          </div>

          <div>
            <span>Recent Activity</span>
            <strong>{loading ? "..." : recentActivity}</strong>
          </div>
        </div>
      </div>

      <section className="notifications-panel">
        <div className="notifications-panel-header">
          <div>
            <h3>Recent Notifications</h3>

            <p>Your latest project and team activity</p>
          </div>
        </div>

        {loading ? (
          <div className="notifications-empty">
            <div className="notifications-empty-icon">
              <Bell size={28} />
            </div>

            <h3>Loading notifications...</h3>

            <p>Checking for your latest project and team activity.</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notifications-empty">
            <div className="notifications-empty-icon">
              <Bell size={28} />
            </div>

            <h3>No notifications yet</h3>

            <p>
              Project updates, task assignments, team activity, and other
              important notifications will appear here.
            </p>
          </div>
        ) : (
          <div className="notification-list">
            {notifications.map((notification) => (
              <div className="notification-card" key={notification.id}>
                <div className="notification-card-icon">
                  <Bell size={18} />
                </div>

                <div className="notification-card-content">
                  <h3>{notification.title}</h3>

                  <p>{notification.message}</p>
                </div>

                {!notification.is_read && (
                  <button
                    className="notification-unread"
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    Unread
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Notifications;
