import {
  Bell,
  Search,
  LogOut,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { logout, getCurrentUser } from "../services/authService";

import { getUnreadNotifications } from "../services/notificationService";
import { useWorkspace } from "../context/WorkspaceContext";

import WorkspaceSwitcher from "./WorkspaceSwitcher";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const { activeWorkspace } = useWorkspace();

  const [currentUser, setCurrentUser] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // ======================================================
  // CURRENT USER
  // ======================================================

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      try {
        const response = await getCurrentUser();

        const user =
          response?.user || response?.data?.user || response?.data || response;

        if (isMounted && user && typeof user === "object") {
          setCurrentUser(user);
        }
      } catch (error) {
        console.error("Failed to load current user:", error);

        if (isMounted) {
          setCurrentUser(null);
        }
      }
    }

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  // ======================================================
  // DISPLAY NAME AND AVATAR
  // ======================================================

  const displayName =
    currentUser?.name ||
    currentUser?.full_name ||
    currentUser?.username ||
    currentUser?.email?.split("@")[0] ||
    "ZYRA User";

  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || "Z";

  // ======================================================
  // WORKSPACE ROLE LABEL
  // ======================================================

  function getWorkspaceRoleLabel() {
    const role = String(
      activeWorkspace?.role ||
        activeWorkspace?.workspace_role ||
        activeWorkspace?.membership_role ||
        "",
    )
      .trim()
      .toUpperCase();

    const roleLabels = {
      ADMIN: "Administrator",
      HR: "Human Resources",
      TEAM_LEADER: "Team Leader",
      USER: "Team Member",
    };

    return roleLabels[role] || "Workspace Member";
  }

  const displayRole = getWorkspaceRoleLabel();

  // ======================================================
  // NOTIFICATIONS
  // ======================================================

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

  // ======================================================
  // LOGOUT
  // ======================================================

  function handleLogout() {
    // Close the profile menu.
    setShowProfileMenu(false);

    // Clear user-related Navbar state.
    setCurrentUser(null);
    setUnreadCount(0);

    // Clear authentication token, active workspace,
    // dashboard history and saved portal session.
    logout();

    // Send EVERY account type to the main ZYRA landing page.
    // Replace the current browser history entry.
    navigate("/", {
      replace: true,
    });
  }

  // ======================================================
  // NAVIGATION
  // ======================================================

  function handleNotificationClick() {
    setUnreadCount(0);
    navigate("/notifications");
  }

  function handleProfileClick(event) {
    event.stopPropagation();

    setShowProfileMenu((current) => !current);
  }

  function handleProfileKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      setShowProfileMenu((current) => !current);
    }

    if (event.key === "Escape") {
      setShowProfileMenu(false);
    }
  }

  function handleOpenProfile() {
    setShowProfileMenu(false);
    navigate("/profile");
  }

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <nav className="zyra-navbar">
      {/* SEARCH */}

      <div className="navbar-search">
        <Search size={17} />

        <input type="text" placeholder="Search ZYRA..." />
      </div>

      {/* WORKSPACE SWITCHER */}

      <WorkspaceSwitcher />

      {/* NOTIFICATION BELL */}

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

      {/* PROFILE */}

      <div
        className="navbar-profile"
        onClick={handleProfileClick}
        onKeyDown={handleProfileKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={showProfileMenu}
        aria-label={`Profile menu for ${displayName}`}
        style={{
          position: "relative",
          cursor: "pointer",
        }}
      >
        {/* DYNAMIC AVATAR */}

        <div className="profile-avatar">{avatarInitial}</div>

        {/* DYNAMIC USER DETAILS */}

        <div className="profile-info">
          <strong>{displayName}</strong>
          <span>{displayRole}</span>
        </div>

        {/* DROPDOWN INDICATOR */}

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

        {/* PROFILE DROPDOWN */}

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
            {/* PROFILE HEADER */}

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
              {/* DYNAMIC DROPDOWN AVATAR */}

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
                {avatarInitial}
              </div>

              {/* DYNAMIC DROPDOWN NAME */}

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
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {displayName}
                </strong>

                <span
                  style={{
                    color: "#8b98a7",
                    fontSize: "12px",
                  }}
                >
                  {displayRole}
                </span>
              </div>
            </div>

            {/* PROFILE */}

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

            {/* LOGOUT */}

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
