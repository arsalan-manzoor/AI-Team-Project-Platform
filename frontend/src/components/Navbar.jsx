import {
  Bell,
  Search,
  LogOut,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { logout } from "../services/authService";
import { getUnreadNotifications } from "../services/notificationService";

function Navbar() {
  const navigate = useNavigate();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadUnreadNotifications() {
      try {
        const notifications = await getUnreadNotifications();

        if (isMounted) {
          setUnreadCount(
            Array.isArray(notifications) ? notifications.length : 0,
          );
        }
      } catch (error) {
        console.error("Failed to load unread notifications:", error);

        if (isMounted) {
          setUnreadCount(0);
        }
      }
    }

    loadUnreadNotifications();

    const notificationInterval = setInterval(loadUnreadNotifications, 30000);

    return () => {
      isMounted = false;
      clearInterval(notificationInterval);
    };
  }, []);

  function handleLogout() {
    logout();
    setShowProfileMenu(false);
    navigate("/login");
  }

  function handleNotificationClick() {
    navigate("/notifications");
  }

  function handleProfileClick(event) {
    event.stopPropagation();
    setShowProfileMenu((current) => !current);
  }

  function handleOpenProfile() {
    setShowProfileMenu(false);
    navigate("/profile");
  }

  return (
    <nav className="zyra-navbar">
      {/* Search */}
      <div className="navbar-search">
        <Search size={17} />

        <input type="text" placeholder="Search ZYRA..." />
      </div>

      {/* Notification Bell */}
      <button
        type="button"
        className="navbar-icon-btn"
        onClick={handleNotificationClick}
        aria-label="Notifications"
        style={{
          position: "relative",
          cursor: "pointer",
        }}
      >
        <Bell size={19} />

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              minWidth: "18px",
              height: "18px",
              padding: "0 5px",
              borderRadius: "999px",
              background: "#ef4444",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: "1",
              border: "2px solid #080b0f",
              boxSizing: "border-box",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Profile */}
      <div
        className="navbar-profile"
        onClick={handleProfileClick}
        style={{
          position: "relative",
          cursor: "pointer",
        }}
      >
        <div className="profile-avatar">A</div>

        <div className="profile-info">
          <strong>Arsalan</strong>
          <span>Workspace Member</span>
        </div>

        {/* Visible dropdown indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: "6px",
            color: "#8b98a7",
          }}
        >
          {showProfileMenu ? (
            <ChevronUp size={15} />
          ) : (
            <ChevronDown size={15} />
          )}
        </div>

        {/* Profile Dropdown */}
        {showProfileMenu && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 12px)",
              right: "0",
              width: "220px",
              background: "#10151b",
              border: "1px solid #2a343f",
              borderRadius: "12px",
              padding: "8px",
              zIndex: 9999,
              boxShadow: "0 18px 45px rgba(0, 0, 0, 0.55)",
              overflow: "hidden",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {/* Profile Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "11px",
                padding: "12px 10px",
                borderBottom: "1px solid #26313b",
                marginBottom: "6px",
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontWeight: "700",
                  fontSize: "15px",
                  flexShrink: 0,
                }}
              >
                A
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  minWidth: 0,
                }}
              >
                <strong
                  style={{
                    color: "#f8fafc",
                    fontSize: "14px",
                  }}
                >
                  Arsalan
                </strong>

                <span
                  style={{
                    color: "#8b98a7",
                    fontSize: "12px",
                  }}
                >
                  Workspace Member
                </span>
              </div>
            </div>

            {/* Profile */}
            <button
              type="button"
              onClick={handleOpenProfile}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "11px 10px",
                border: "none",
                borderRadius: "8px",
                background: "transparent",
                color: "#d7dee7",
                cursor: "pointer",
                fontSize: "14px",
                textAlign: "left",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "#1b2530";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
              }}
            >
              <User size={16} />
              Profile
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "11px 10px",
                border: "none",
                borderRadius: "8px",
                background: "transparent",
                color: "#f87171",
                cursor: "pointer",
                fontSize: "14px",
                textAlign: "left",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background =
                  "rgba(239, 68, 68, 0.10)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
              }}
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
