import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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
  Trash2,
  Eye,
} from "lucide-react";

import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
} from "../services/notificationService";

import { apiRequest } from "../services/api";

import "../styles/notifications.css";

function Notifications() {
  const navigate = useNavigate();
  const location = useLocation();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const [deletingNotificationId, setDeletingNotificationId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [openingInvitationId, setOpeningInvitationId] = useState(null);

  // ======================================================
  // LOAD NOTIFICATIONS
  // ======================================================

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");

      const data = await getNotifications();
      const loadedNotifications = Array.isArray(data) ? data : [];

      // Do not automatically mark unread notifications as read.
      setNotifications(loadedNotifications);
    } catch (requestError) {
      setError(requestError?.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  // ======================================================
  // MARK ONE NOTIFICATION AS READ
  // ======================================================

  async function handleMarkAsRead(notificationId) {
    try {
      setError("");

      await markNotificationAsRead(notificationId);

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          String(notification.id) === String(notificationId)
            ? { ...notification, is_read: true }
            : notification,
        ),
      );
    } catch (requestError) {
      setError(
        requestError?.message || "Failed to mark the notification as read.",
      );
    }
  }

  // ======================================================
  // MARK ALL NOTIFICATIONS AS READ
  // ======================================================

  async function handleMarkAllAsRead() {
    try {
      setError("");

      await markAllNotificationsAsRead();

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          is_read: true,
        })),
      );
    } catch (requestError) {
      setError(
        requestError?.message || "Failed to mark all notifications as read.",
      );
    }
  }

  // ======================================================
  // DELETE ONE NOTIFICATION
  // ======================================================

  async function handleDeleteNotification(notificationId) {
    try {
      setDeletingNotificationId(notificationId);
      setError("");

      await deleteNotification(notificationId);

      setNotifications((currentNotifications) =>
        currentNotifications.filter(
          (notification) => String(notification.id) !== String(notificationId),
        ),
      );
    } catch (requestError) {
      setError(requestError?.message || "Failed to delete the notification.");
    } finally {
      setDeletingNotificationId(null);
    }
  }

  // ======================================================
  // DELETE ALL NOTIFICATIONS
  // ======================================================

  async function handleDeleteAllNotifications() {
    const confirmed = window.confirm(
      "Are you sure you want to delete all notifications? This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingAll(true);
      setError("");

      await deleteAllNotifications();

      setNotifications([]);
    } catch (requestError) {
      setError(requestError?.message || "Failed to delete all notifications.");
    } finally {
      setDeletingAll(false);
    }
  }

  // ======================================================
  // GET INVITATION ID FROM NOTIFICATION
  // ======================================================

  function getInvitationId(notification) {
    if (!notification) {
      return null;
    }

    // Prefer a dedicated invitation ID if the API provides one.
    if (
      notification.invitation_id !== undefined &&
      notification.invitation_id !== null
    ) {
      const invitationId = Number(notification.invitation_id);

      return Number.isInteger(invitationId) && invitationId > 0
        ? invitationId
        : null;
    }

    // Current backend stores the invitation ID in reference_id.
    if (
      String(notification.notification_type || "").toUpperCase() ===
        "EMPLOYEE_INVITATION" &&
      notification.reference_id !== undefined &&
      notification.reference_id !== null
    ) {
      const invitationId = Number(notification.reference_id);

      return Number.isInteger(invitationId) && invitationId > 0
        ? invitationId
        : null;
    }

    // Fallback for older notifications.
    const message = String(notification.message || "");
    const match = message.match(/Invitation ID:\s*(\d+)/i);

    if (match) {
      const invitationId = Number(match[1]);

      return Number.isInteger(invitationId) && invitationId > 0
        ? invitationId
        : null;
    }

    return null;
  }

  // ======================================================
  // DETECT INVITATION NOTIFICATIONS
  // ======================================================

  function isEmployeeInvitation(notification) {
    if (!notification) {
      return false;
    }

    const title = String(notification.title || "").toLowerCase();
    const type = String(notification.notification_type || "").toUpperCase();

    return (
      type === "EMPLOYEE_INVITATION" ||
      title.includes("company invitation") ||
      title.includes("individual workspace invitation")
    );
  }

  function isCompanyInvitation(notification) {
    const title = String(notification?.title || "").toLowerCase();

    return title.includes("company invitation");
  }

  function isIndividualInvitation(notification) {
    const title = String(notification?.title || "").toLowerCase();

    return title.includes("individual workspace invitation");
  }

  // ======================================================
  // REVIEW INVITATION
  // ======================================================
  //
  // 1. Read the invitation ID from the notification.
  // 2. Validate that exact invitation with the backend.
  // 3. Open its detail page only if the invitation is available.
  // 4. If the invitation has expired or is unavailable, remain
  //    on Notifications and show an actionable error.
  //
  // This avoids sending users to an empty invitation list or
  // to the landing page when a notification is stale.
  // ======================================================

  async function handleReviewInvitation(notification) {
    if (openingInvitationId !== null) {
      return;
    }

    const invitationId = getInvitationId(notification);

    if (!invitationId) {
      setError(
        "This notification does not contain a valid invitation ID. Ask the company administrator to send a new invitation.",
      );
      return;
    }

    setOpeningInvitationId(String(invitationId));
    setError("");

    try {
      // Check that this specific invitation is still available.
      await apiRequest(
        `/workspaces/invitations/id/${encodeURIComponent(invitationId)}`,
      );

      // The invitation is available. Open that exact invitation.
      // Preserve the page the user came from for return navigation.
      navigate(`/employee-invitation/id/${encodeURIComponent(invitationId)}`, {
        state: {
          returnTo: `${location.pathname}${location.search}`,
          sourceNotificationId: notification.id,
          sourcePage: "notifications",
        },
      });
    } catch (requestError) {
      const message = String(requestError?.message || "");

      const isUnavailable =
        /expired|no longer active|invalid invitation|invitation not found/i.test(
          message,
        );

      if (isUnavailable) {
        setError(
          "This invitation has expired or is no longer active. You are still on Notifications. Ask the company administrator to send a new invitation.",
        );
      } else {
        setError(
          message ||
            "We could not verify this invitation. Please refresh Notifications and try again.",
        );
      }
    } finally {
      setOpeningInvitationId(null);
    }
  }

  // ======================================================
  // NOTIFICATION COUNTS
  // ======================================================

  const totalNotifications = notifications.length;

  const unreadNotifications = notifications.filter(
    (notification) => !notification.is_read,
  ).length;

  const recentActivity = notifications.filter(
    (notification) => notification.created_at,
  ).length;

  const taskNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        const text = `${notification.title || ""} ${
          notification.message || ""
        }`.toLowerCase();

        return (
          text.includes("task") ||
          text.includes("assigned") ||
          text.includes("deadline")
        );
      }),
    [notifications],
  );

  const teamNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        const text = `${notification.title || ""} ${
          notification.message || ""
        }`.toLowerCase();

        return (
          text.includes("team") ||
          text.includes("member") ||
          text.includes("invited") ||
          text.includes("joined")
        );
      }),
    [notifications],
  );

  // ======================================================
  // FILTER NOTIFICATIONS
  // ======================================================

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

  // ======================================================
  // NOTIFICATION CATEGORIES
  // ======================================================

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

  // ======================================================
  // FORMAT NOTIFICATION TIMESTAMPS
  // ======================================================

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

  // ======================================================
  // NOTIFICATION DISTRIBUTION
  // ======================================================

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

  // ======================================================
  // PAGE
  // ======================================================

  return (
    <div className="zyra-notifications">
      {/* BACKGROUND */}

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

      {/* HEADER */}

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

      {/* ERROR / STATUS MESSAGE */}

      {error && (
        <div className="notifications-error" role="alert">
          <span>{error}</span>

          <button
            type="button"
            className="notification-error-close"
            onClick={() => setError("")}
            aria-label="Dismiss notification message"
            title="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* STATISTICS */}

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

      {/* MAIN WORKSPACE */}

      <div className="notifications-workspace">
        {/* LIVE ACTIVITY */}

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
                onClick={() => void handleMarkAllAsRead()}
                disabled={unreadNotifications === 0}
              >
                <CheckCheck size={13} />
                Mark all as read
              </button>

              <button
                type="button"
                className="notifications-delete-all"
                onClick={() => void handleDeleteAllNotifications()}
                disabled={totalNotifications === 0 || deletingAll}
              >
                <Trash2 size={13} />
                {deletingAll ? "Deleting..." : "Delete all"}
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

                const isDeleting =
                  String(deletingNotificationId) === String(notification.id);

                const employeeInvitation = isEmployeeInvitation(notification);

                const companyInvitation = isCompanyInvitation(notification);

                const individualInvitation =
                  isIndividualInvitation(notification);

                const invitationId = employeeInvitation
                  ? getInvitationId(notification)
                  : null;

                const isOpeningInvitation =
                  String(openingInvitationId) === String(invitationId);

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

                        <button
                          type="button"
                          className="notification-delete-action"
                          onClick={() =>
                            void handleDeleteNotification(notification.id)
                          }
                          disabled={isDeleting || deletingAll}
                          aria-label="Delete notification"
                          title="Delete notification"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="notification-card-content">
                        <h3>{notification.title}</h3>
                        <p>{notification.message}</p>
                      </div>

                      {/* EMPLOYEE / WORKSPACE INVITATION */}

                      {employeeInvitation && (
                        <div className="company-invitation-actions">
                          <button
                            type="button"
                            className="company-invitation-review"
                            onClick={() =>
                              void handleReviewInvitation(notification)
                            }
                            disabled={
                              openingInvitationId !== null || !invitationId
                            }
                            title={
                              !invitationId
                                ? "This notification has no valid invitation ID."
                                : "Verify and review this invitation"
                            }
                          >
                            <Eye size={14} />

                            {isOpeningInvitation
                              ? "Checking invitation..."
                              : companyInvitation
                                ? "Review Company Invitation"
                                : individualInvitation
                                  ? "Review Workspace Invitation"
                                  : "Review Invitation"}
                          </button>
                        </div>
                      )}

                      {!notification.is_read && (
                        <button
                          type="button"
                          className="notification-read-action"
                          onClick={() => void handleMarkAsRead(notification.id)}
                          disabled={isDeleting}
                        >
                          Mark as read
                        </button>
                      )}

                      {isDeleting && (
                        <span className="notification-deleting-label">
                          Deleting...
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* RIGHT SIDEBAR */}

        <aside className="notifications-side">
          {/* NOTIFICATION STATUS */}

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

          {/* ACTIVITY COUNTS */}

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
