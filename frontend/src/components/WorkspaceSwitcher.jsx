import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Check } from "lucide-react";

import { useWorkspace } from "../context/WorkspaceContext.jsx";

// ======================================================
// ROLE HELPERS
// ======================================================

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function getWorkspaceRoles(workspace) {
  const roles = Array.isArray(workspace?.roles) ? workspace.roles : [];

  return [
    ...new Set([...roles, workspace?.role].map(normalizeRole).filter(Boolean)),
  ];
}

// ======================================================
// WORKSPACE ICON
// ======================================================

function getWorkspaceIcon(workspaceType) {
  const type = normalizeRole(workspaceType);

  if (type === "COMPANY") {
    return "C";
  }

  if (type === "INDIVIDUAL") {
    return "I";
  }

  return "P";
}

// ======================================================
// DASHBOARD ROUTING
// ======================================================

function getWorkspaceDashboardPath(workspace, role) {
  const workspaceType = normalizeRole(
    workspace?.type ?? workspace?.workspace_type ?? workspace?.workspaceType,
  );

  const normalizedRole = normalizeRole(role);

  const dashboardPaths = {
    INDIVIDUAL: {
      TEAM_LEADER: "/dashboard/individual/team-leader",
      USER: "/dashboard/individual/user",
    },

    COMPANY: {
      ADMIN: "/dashboard/company/admin",
      HR: "/dashboard/company/hr",
      TEAM_LEADER: "/dashboard/company/team-leader",
      USER: "/dashboard/company/user",
    },
  };

  return dashboardPaths[workspaceType]?.[normalizedRole] || null;
}

// ======================================================
// WORKSPACE SWITCHER
// ======================================================

function WorkspaceSwitcher() {
  const navigate = useNavigate();

  const {
    workspaces,
    activeWorkspace,
    workspaceRole,
    switchWorkspace,
    loading,
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);

  // ======================================================
  // SELECT WORKSPACE AND ROLE
  // ======================================================

  function handleWorkspaceSelect(workspace, role) {
    const dashboardPath = getWorkspaceDashboardPath(workspace, role);

    /*
     * Do not switch to a role for which the application has
     * no matching dashboard route.
     *
     * This prevents the frontend from changing its context
     * while remaining on an incompatible dashboard.
     */
    if (!dashboardPath) {
      console.error("No dashboard route exists for this workspace and role:", {
        workspaceId: workspace?.id,
        workspaceType:
          workspace?.type ??
          workspace?.workspace_type ??
          workspace?.workspaceType,
        role,
      });

      setIsOpen(false);
      return;
    }

    /*
     * Update the active workspace and selected role.
     *
     * WorkspaceContext is responsible for persisting the
     * selection so that it can be restored after refresh.
     */
    switchWorkspace(workspace.id, role);

    // Close the dropdown.
    setIsOpen(false);

    /*
     * Navigate to the correct role-specific dashboard.
     *
     * For example:
     * Individual + TEAM_LEADER -> Individual LeadDash
     * Company + TEAM_LEADER    -> Company TeamDash
     * Individual + USER        -> Individual User dashboard
     * Company + USER           -> Company User dashboard
     */
    navigate(dashboardPath, {
      replace: true,
    });
  }

  // ======================================================
  // LOADING STATE
  // ======================================================

  if (loading) {
    return (
      <div className="workspace-switcher">
        <div className="workspace-switcher-trigger">
          <div className="workspace-switcher-info">
            <strong>Loading workspace...</strong>
            <span>Please wait</span>
          </div>
        </div>
      </div>
    );
  }

  // ======================================================
  // NO ACTIVE WORKSPACE
  // ======================================================

  if (!activeWorkspace) {
    return null;
  }

  // ======================================================
  // ACTIVE WORKSPACE DETAILS
  // ======================================================

  const activeWorkspaceType =
    activeWorkspace.type ||
    activeWorkspace.workspace_type ||
    activeWorkspace.workspaceType;

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="workspace-switcher" style={{ position: "relative" }}>
      {/* ================================================
          ACTIVE WORKSPACE AND ROLE
      ================================================ */}

      <button
        type="button"
        className="workspace-switcher-trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Active workspace: ${activeWorkspace.name}, role: ${workspaceRole}. Switch workspace or role.`}
      >
        <div className="workspace-switcher-icon">
          {getWorkspaceIcon(activeWorkspaceType)}
        </div>

        <div className="workspace-switcher-info">
          <strong>{activeWorkspace.name}</strong>
          <span>{workspaceRole}</span>
        </div>

        <ChevronDown
          size={16}
          className={isOpen ? "workspace-chevron-open" : ""}
        />
      </button>

      {/* ================================================
          WORKSPACE AND ROLE OPTIONS
      ================================================ */}

      {isOpen && (
        <div
          className="workspace-switcher-menu"
          role="menu"
          aria-label="Select workspace and role"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="workspace-menu-heading">
            <span>CHOOSE WORKSPACE &amp; ROLE</span>
          </div>

          {workspaces.flatMap((workspace) => {
            const workspaceRoles = getWorkspaceRoles(workspace);

            const workspaceType =
              workspace.type ||
              workspace.workspace_type ||
              workspace.workspaceType;

            return workspaceRoles.map((role) => {
              const isActive =
                String(workspace.id) === String(activeWorkspace.id) &&
                normalizeRole(role) === normalizeRole(workspaceRole);

              return (
                <button
                  key={`${workspace.id}-${role}`}
                  type="button"
                  className={`workspace-option ${
                    isActive ? "workspace-option-active" : ""
                  }`}
                  onClick={() => handleWorkspaceSelect(workspace, role)}
                  role="menuitem"
                  aria-current={isActive ? "true" : undefined}
                  title={`Switch to ${workspace.name} as ${role}`}
                >
                  <div className="workspace-option-icon">
                    {getWorkspaceIcon(workspaceType)}
                  </div>

                  <div className="workspace-option-info">
                    <strong>{workspace.name}</strong>

                    <span>
                      {normalizeRole(workspaceType)} · {role}
                    </span>
                  </div>

                  {isActive && <Check size={16} />}
                </button>
              );
            });
          })}

          {workspaces.length === 0 && (
            <div className="workspace-menu-heading">
              <span>No workspaces available</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WorkspaceSwitcher;
