import { Bell, CheckCheck, Clock3 } from "lucide-react";

function Notifications() {
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

        <button className="notifications-read-btn">
          <CheckCheck size={16} />
          Mark all as read
        </button>
      </div>

      <div className="notifications-summary">
        <div className="notification-summary-card">
          <div className="notification-summary-icon">
            <Bell size={19} />
          </div>
          <div>
            <span>Total Notifications</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="notification-summary-card">
          <div className="notification-summary-icon">
            <Bell size={19} />
          </div>
          <div>
            <span>Unread</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="notification-summary-card">
          <div className="notification-summary-icon">
            <Clock3 size={19} />
          </div>
          <div>
            <span>Recent Activity</span>
            <strong>0</strong>
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
      </section>
    </div>
  );
}

export default Notifications;
