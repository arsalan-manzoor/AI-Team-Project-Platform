import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCheck,
  Clock3,
  CheckSquare,
  MessageSquare,
  Users,
  Folder,
  Rocket,
  Settings,
  FileText,
  Activity,
} from "lucide-react";

import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../services/notificationService";

import "../styles/notifications.css";

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

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

  const taskNotifications = notifications.filter((notification) => {
    const text = `${notification.title || ""} ${
      notification.message || ""
    }`.toLowerCase();

    return (
      text.includes("task") ||
      text.includes("assigned") ||
      text.includes("deadline")
    );
  });

  const teamNotifications = notifications.filter((notification) => {
    const text = `${notification.title || ""} ${
      notification.message || ""
    }`.toLowerCase();

    return (
      text.includes("team") ||
      text.includes("member") ||
      text.includes("invited") ||
      text.includes("joined")
    );
  });

  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case "unread":
        return notifications.filter((notification) => !notification.is_read);

      case "tasks":
        return taskNotifications;

      case "teams":
        return teamNotifications;

      case "system":
        return notifications.filter((notification) => {
          const text = `${notification.title || ""} ${
            notification.message || ""
          }`.toLowerCase();

          return (
            text.includes("system") ||
            text.includes("deployment") ||
            text.includes("settings")
          );
        });

      case "files":
        return notifications.filter((notification) => {
          const text = `${notification.title || ""} ${
            notification.message || ""
          }`.toLowerCase();

          return (
            text.includes("file") ||
            text.includes("document") ||
            text.includes("resource")
          );
        });

      default:
        return notifications;
    }
  }, [activeFilter, notifications, taskNotifications, teamNotifications]);

  function getNotificationCategory(notification) {
    const text = `${notification.title || ""} ${
      notification.message || ""
    }`.toLowerCase();

    if (
      text.includes("task") ||
      text.includes("assigned") ||
      text.includes("deadline")
    ) {
      return {
        label: "Task",
        className: "task",
        icon: CheckSquare,
      };
    }

    if (
      text.includes("comment") ||
      text.includes("mentioned") ||
      text.includes("message")
    ) {
      return {
        label: "Comment",
        className: "comment",
        icon: MessageSquare,
      };
    }

    if (
      text.includes("team") ||
      text.includes("member") ||
      text.includes("invited") ||
      text.includes("joined")
    ) {
      return {
        label: "Team",
        className: "team",
        icon: Users,
      };
    }

    if (text.includes("project") || text.includes("milestone")) {
      return {
        label: "Project",
        className: "project",
        icon: Folder,
      };
    }

    if (
      text.includes("deployment") ||
      text.includes("deployed") ||
      text.includes("build")
    ) {
      return {
        label: "Deployment",
        className: "deployment",
        icon: Rocket,
      };
    }

    if (
      text.includes("file") ||
      text.includes("document") ||
      text.includes("resource")
    ) {
      return {
        label: "Files",
        className: "files",
        icon: FileText,
      };
    }

    if (text.includes("system") || text.includes("settings")) {
      return {
        label: "System",
        className: "system",
        icon: Settings,
      };
    }

    return {
      label: "Activity",
      className: "activity",
      icon: Bell,
    };
  }

  function formatNotificationTime(createdAt) {
    if (!createdAt) {
      return "Recent";
    }

    const date = new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
      return "Recent";
    }

    const now = new Date();
    const difference = now.getTime() - date.getTime();

    const minutes = Math.floor(difference / (1000 * 60));

    if (minutes < 1) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes} min ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
      return `${days}d ago`;
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  }

  const statusDistribution = [
    {
      label: "Tasks",
      value: taskNotifications.length,
      className: "task",
    },
    {
      label: "System",
      value: notifications.filter((notification) => {
        const text = `${notification.title || ""} ${
          notification.message || ""
        }`.toLowerCase();

        return (
          text.includes("system") ||
          text.includes("deployment") ||
          text.includes("settings")
        );
      }).length,
      className: "system",
    },
    {
      label: "Team",
      value: teamNotifications.length,
      className: "team",
    },
    {
      label: "Files",
      value: notifications.filter((notification) => {
        const text = `${notification.title || ""} ${
          notification.message || ""
        }`.toLowerCase();

        return (
          text.includes("file") ||
          text.includes("document") ||
          text.includes("resource")
        );
      }).length,
      className: "files",
    },
  ];

  return (
    <div className="zyra-notifications">
      {/* =====================================================
          BACKGROUND
          ===================================================== */}

      <div className="notifications-background-grid" />

      <div className="notifications-glow notifications-glow-one" />

      <div className="notifications-glow notifications-glow-two" />

      <div className="notifications-circuit">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="notifications-header">
        <div className="notifications-header-main">
          <div className="notifications-live-label">
            <span className="notifications-live-dot" />
            LIVE ACTIVITY
          </div>

          <div className="notifications-title-row">
            <div>
              <h2>Notifications</h2>

              <p className="notifications-subtitle">
                Stay updated with activity across your projects and teams.
              </p>
            </div>

            <div className="notifications-workspace-pill">
              <span className="workspace-pill-dot" />
              WORKSPACE ACTIVE: ZYRA
            </div>
          </div>
        </div>
      </header>

      {error && <div className="notifications-error">{error}</div>}

      {/* =====================================================
          STATISTICS
          ===================================================== */}

      <section className="notifications-summary">
        <div className="notification-summary-card">
          <div className="notification-summary-content">
            <span>Total Notifications</span>

            <strong>{loading ? "..." : totalNotifications}</strong>
          </div>

          <div className="notification-summary-dot blue" />
        </div>

        <div className="notification-summary-card">
          <div className="notification-summary-content">
            <span>Unread</span>

            <strong>{loading ? "..." : unreadNotifications}</strong>
          </div>

          <div className="notification-summary-dot cyan" />
        </div>

        <div className="notification-summary-card">
          <div className="notification-summary-content">
            <span>Task Updates</span>

            <strong>{loading ? "..." : taskNotifications.length}</strong>
          </div>

          <div className="notification-summary-dot blue" />
        </div>

        <div className="notification-summary-card">
          <div className="notification-summary-content">
            <span>Team Activity</span>

            <strong>{loading ? "..." : teamNotifications.length}</strong>
          </div>

          <div className="notification-summary-dot blue" />
        </div>
      </section>

      {/* =====================================================
          MAIN WORKSPACE
          ===================================================== */}

      <div className="notifications-workspace">
        {/* ===================================================
            LIVE ACTIVITY
            =================================================== */}

        <section className="notifications-panel">
          <div className="notifications-panel-header">
            <div>
              <div className="notifications-section-label">
                <span className="section-live-dot" />
                LIVE ACTIVITY
              </div>

              <h3>Recent Notifications</h3>
            </div>

            <div className="notifications-filter-group">
              <button
                type="button"
                className={
                  activeFilter === "all"
                    ? "notification-filter active"
                    : "notification-filter"
                }
                onClick={() => setActiveFilter("all")}
              >
                All
              </button>

              <button
                type="button"
                className={
                  activeFilter === "unread"
                    ? "notification-filter active"
                    : "notification-filter"
                }
                onClick={() => setActiveFilter("unread")}
              >
                Unread
              </button>

              <button
                type="button"
                className={
                  activeFilter === "tasks"
                    ? "notification-filter active"
                    : "notification-filter"
                }
                onClick={() => setActiveFilter("tasks")}
              >
                Tasks
              </button>

              <button
                type="button"
                className={
                  activeFilter === "teams"
                    ? "notification-filter active"
                    : "notification-filter"
                }
                onClick={() => setActiveFilter("teams")}
              >
                Teams
              </button>

              <button
                type="button"
                className={
                  activeFilter === "system"
                    ? "notification-filter active"
                    : "notification-filter"
                }
                onClick={() => setActiveFilter("system")}
              >
                System
              </button>

              <button
                type="button"
                className={
                  activeFilter === "files"
                    ? "notification-filter active"
                    : "notification-filter"
                }
                onClick={() => setActiveFilter("files")}
              >
                Files
              </button>

              <button
                type="button"
                className="notifications-mark-all"
                onClick={handleMarkAllAsRead}
                disabled={unreadNotifications === 0}
              >
                <CheckCheck size={13} />
                Mark all as read
              </button>
            </div>
          </div>

          {loading ? (
            <div className="notifications-empty">
              <div className="notifications-empty-icon">
                <Activity size={27} />
              </div>

              <h3>Loading activity...</h3>

              <p>Checking for your latest project and team activity.</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="notifications-empty">
              <div className="notifications-empty-icon">
                <Bell size={27} />
              </div>

              <h3>
                {activeFilter === "all"
                  ? "No notifications yet"
                  : "No activity in this view"}
              </h3>

              <p>
                {activeFilter === "all"
                  ? "Project updates, task assignments, team activity and other important notifications will appear here."
                  : "There are currently no notifications matching this filter."}
              </p>
            </div>
          ) : (
            <div className="notification-feed">
              <div className="notification-timeline-line" />

              {filteredNotifications.map((notification, index) => {
                const category = getNotificationCategory(notification);

                const CategoryIcon = category.icon;

                return (
                  <article
                    className={
                      notification.is_read
                        ? "notification-item"
                        : "notification-item unread"
                    }
                    key={notification.id}
                    style={{
                      "--notification-index": index,
                    }}
                  >
                    <div className={`notification-node ${category.className}`}>
                      <CategoryIcon size={15} />
                    </div>

                    <div className={`notification-card ${category.className}`}>
                      <div className="notification-card-top">
                        <div className="notification-category">
                          {category.label}
                        </div>

                        <div className="notification-time">
                          <Clock3 size={11} />
                          {formatNotificationTime(notification.created_at)}
                        </div>

                        {!notification.is_read && (
                          <span className="notification-unread-dot" />
                        )}
                      </div>

                      <div className="notification-card-content">
                        <h3>{notification.title}</h3>

                        <p>{notification.message}</p>
                      </div>

                      {!notification.is_read && (
                        <button
                          type="button"
                          className="notification-read-action"
                          onClick={() => handleMarkAsRead(notification.id)}
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ===================================================
            RIGHT SIDEBAR
            =================================================== */}

        <aside className="notifications-side">
          {/* Notification Status */}

          <section className="notification-status-panel">
            <div className="notification-side-header">
              <div>
                <span className="notification-side-label">
                  NOTIFICATION STATUS
                </span>

                <h3>Distribution</h3>
              </div>

              <Bell size={15} />
            </div>

            <div className="notification-status-list">
              {statusDistribution.map((status) => {
                const percentage =
                  totalNotifications > 0
                    ? Math.round((status.value / totalNotifications) * 100)
                    : 0;

                return (
                  <div className="notification-status-row" key={status.label}>
                    <div className="notification-status-top">
                      <span>{status.label}</span>

                      <strong>{percentage}%</strong>
                    </div>

                    <div className="notification-status-track">
                      <span
                        className={`notification-status-bar ${status.className}`}
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>

                    <span className="notification-status-count">
                      {status.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Activity Counts */}

          <section className="activity-counts-panel">
            <div className="notification-side-header">
              <div>
                <span className="notification-side-label">ACTIVITY COUNTS</span>

                <h3>Today&apos;s Activity</h3>
              </div>

              <Activity size={15} />
            </div>

            <div className="activity-count-highlight">
              <strong>{loading ? "..." : recentActivity}</strong>

              <span>tracked notifications</span>
            </div>

            <div className="activity-count-list">
              <div>
                <span>Unread</span>
                <strong>{loading ? "..." : unreadNotifications}</strong>
              </div>

              <div>
                <span>Task updates</span>
                <strong>{loading ? "..." : taskNotifications.length}</strong>
              </div>

              <div>
                <span>Team activity</span>
                <strong>{loading ? "..." : teamNotifications.length}</strong>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default Notifications;
