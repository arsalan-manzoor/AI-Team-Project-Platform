import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";

import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Building2,
  Bell,
  Mail,
  Sparkles,
  GitBranch,
} from "lucide-react";

// ========================================================
// DASHBOARD NAVIGATION
// ========================================================

const DASHBOARD_PATH_KEY = "zyra_last_dashboard_path";

// Only allow known role-specific dashboard routes.
const ROLE_DASHBOARD_PATHS = [
  "/dashboard/individual/user",
  "/dashboard/individual/team-leader",
  "/dashboard/company/admin",
  "/dashboard/company/hr",
  "/dashboard/company/team-leader",
  "/dashboard/company/user",
];

function isRoleDashboardPath(path) {
  return ROLE_DASHBOARD_PATHS.includes(path);
}

function getSavedDashboardPath() {
  try {
    const savedPath = sessionStorage.getItem(DASHBOARD_PATH_KEY);

    return isRoleDashboardPath(savedPath) ? savedPath : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

// ========================================================
// SIDEBAR
// ========================================================

function Sidebar() {
  const location = useLocation();

  const { activeWorkspace, workspaceType, workspaceRole } = useWorkspace();

  // ======================================================
  // NORMALIZE ACTIVE WORKSPACE INFORMATION
  //
  // Use the existing workspace context first.
  // Fall back to activeWorkspace when necessary.
  // ======================================================

  const normalizedWorkspaceType = String(
    workspaceType ||
      activeWorkspace?.type ||
      activeWorkspace?.workspace_type ||
      activeWorkspace?.workspaceType ||
      "",
  )
    .trim()
    .toUpperCase();

  const normalizedWorkspaceRole = String(
    workspaceRole ||
      activeWorkspace?.role ||
      activeWorkspace?.workspace_role ||
      "",
  )
    .trim()
    .toUpperCase();

  // ======================================================
  // COMPANY NAVIGATION PERMISSIONS
  // ======================================================

  const isCompanyWorkspace = normalizedWorkspaceType === "COMPANY";

  const canViewEmployees =
    isCompanyWorkspace &&
    ["ADMIN", "HR", "TEAM_LEADER"].includes(normalizedWorkspaceRole);

  const canViewReportingStructure =
    isCompanyWorkspace &&
    ["ADMIN", "HR", "TEAM_LEADER"].includes(normalizedWorkspaceRole);

  // ======================================================
  // REMEMBER THE ROLE-SPECIFIC DASHBOARD
  //
  // When the user visits Projects, Tasks, or another
  // section, preserve their previous dashboard destination.
  //
  // This effect synchronizes browser session storage.
  // Dashboard navigation is derived directly during render.
  // ======================================================

  useEffect(() => {
    if (!isRoleDashboardPath(location.pathname)) {
      return;
    }

    try {
      sessionStorage.setItem(DASHBOARD_PATH_KEY, location.pathname);
    } catch {
      // Navigation still works when storage is unavailable.
    }
  }, [location.pathname]);

  // ======================================================
  // DASHBOARD DESTINATION
  // ======================================================

  const dashboardPath = isRoleDashboardPath(location.pathname)
    ? location.pathname
    : getSavedDashboardPath();

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <aside className="zyra-sidebar">
      {/* ==================================================
          WORKSPACE NAVIGATION
      ================================================== */}

      <div className="sidebar-section">
        <p className="sidebar-title">WORKSPACE</p>

        <nav className="sidebar-nav">
          {/* DASHBOARD */}

          <NavLink
            to={dashboardPath}
            end
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <LayoutDashboard className="sidebar-icon" size={18} />

            <span>Dashboard</span>
          </NavLink>

          {/* PROJECTS */}

          <NavLink
            to="/projects"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <FolderKanban className="sidebar-icon" size={18} />

            <span>My Projects</span>
          </NavLink>

          {/* TASKS */}

          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <CheckSquare className="sidebar-icon" size={18} />

            <span>My Tasks</span>
          </NavLink>

          {/* TEAMS */}

          <NavLink
            to="/teams"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <Users className="sidebar-icon" size={18} />

            <span>Teams</span>
          </NavLink>

          {/* MY COMPANY */}

          {isCompanyWorkspace && (
            <NavLink
              to="/my-company"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              <Building2 className="sidebar-icon" size={18} />

              <span>My Company</span>
            </NavLink>
          )}

          {/* EMPLOYEES */}

          {canViewEmployees && (
            <NavLink
              to="/employees"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              <Users className="sidebar-icon" size={18} />

              <span>Employees</span>
            </NavLink>
          )}

          {/* REPORTING STRUCTURE */}

          {canViewReportingStructure && (
            <NavLink
              to="/company/reporting-structure"
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              <GitBranch className="sidebar-icon" size={18} />

              <span>Reporting Structure</span>
            </NavLink>
          )}
        </nav>
      </div>

      {/* ==================================================
          ACTIVITY AND INVITATIONS
      ================================================== */}

      <div className="sidebar-section">
        <p className="sidebar-title">ACTIVITY</p>

        <nav className="sidebar-nav">
          {/* INVITATIONS */}

          <NavLink
            to="/invitations"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <Mail className="sidebar-icon" size={18} />

            <span>Invitations</span>
          </NavLink>

          {/* NOTIFICATIONS */}

          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <Bell className="sidebar-icon" size={18} />

            <span>Notifications</span>
          </NavLink>
        </nav>
      </div>

      {/* ==================================================
          AI ASSISTANT
      ================================================== */}

      <div className="sidebar-ai">
        <NavLink to="/ai-assistant" className="ai-sidebar-link">
          <div className="ai-icon">
            <Sparkles size={18} />
          </div>

          <div>
            <strong>AI Assistant</strong>

            <span>Work smarter with ZYRA</span>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}

export default Sidebar;
