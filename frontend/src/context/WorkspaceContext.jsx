import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getMyWorkspaces } from "../services/workspaceService";
import { getAuthToken } from "../services/api";

const WorkspaceContext = createContext(null);

const STORAGE_KEY = "zyra_active_workspace_id";
const ROLE_STORAGE_PREFIX = "zyra_active_workspace_role_";
const AUTH_CHANGE_EVENT = "zyra-auth-changed";

// ======================================================
// ROLE HELPERS
// ======================================================

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function getWorkspaceRoles(workspace) {
  const rolesFromApi = Array.isArray(workspace?.roles) ? workspace.roles : [];

  const normalizedRoles = [...rolesFromApi, workspace?.role]
    .map(normalizeRole)
    .filter(Boolean);

  return [...new Set(normalizedRoles)];
}

function getRoleForWorkspace(workspace, requestedRole = null) {
  if (!workspace) {
    return null;
  }

  const availableRoles = getWorkspaceRoles(workspace);
  const normalizedRequestedRole = normalizeRole(requestedRole);

  if (
    normalizedRequestedRole &&
    availableRoles.includes(normalizedRequestedRole)
  ) {
    return normalizedRequestedRole;
  }

  const savedRole = normalizeRole(
    localStorage.getItem(`${ROLE_STORAGE_PREFIX}${workspace.id}`),
  );

  if (savedRole && availableRoles.includes(savedRole)) {
    return savedRole;
  }

  const preferredRole = normalizeRole(workspace.role);

  if (preferredRole && availableRoles.includes(preferredRole)) {
    return preferredRole;
  }

  return availableRoles[0] || null;
}

// ======================================================
// PROVIDER
// ======================================================

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ======================================================
  // LOAD AUTHENTICATED USER WORKSPACES
  // ======================================================

  const loadWorkspaces = useCallback(async () => {
    if (!getAuthToken()) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setError("");
      setLoading(false);

      localStorage.removeItem(STORAGE_KEY);

      return false;
    }

    try {
      setLoading(true);
      setError("");

      const data = await getMyWorkspaces();

      const workspaceList = Array.isArray(data?.workspaces)
        ? data.workspaces
        : Array.isArray(data)
          ? data
          : [];

      setWorkspaces(workspaceList);

      // No workspace memberships were returned.
      if (workspaceList.length === 0) {
        setActiveWorkspace(null);
        localStorage.removeItem(STORAGE_KEY);

        return true;
      }

      // Preserve the previously selected workspace.
      const savedWorkspaceId = localStorage.getItem(STORAGE_KEY);

      const savedWorkspace = workspaceList.find(
        (workspace) => String(workspace.id) === String(savedWorkspaceId),
      );

      const selectedWorkspace = savedWorkspace || workspaceList[0];

      // Restore the previously selected role.
      const selectedRole = getRoleForWorkspace(selectedWorkspace);

      const resolvedWorkspace = {
        ...selectedWorkspace,
        role: selectedRole,
      };

      setActiveWorkspace(resolvedWorkspace);

      localStorage.setItem(STORAGE_KEY, String(selectedWorkspace.id));

      if (selectedRole) {
        localStorage.setItem(
          `${ROLE_STORAGE_PREFIX}${selectedWorkspace.id}`,
          selectedRole,
        );
      }

      // Confirm that workspace loading completed.
      return true;
    } catch (err) {
      console.error("Failed to load workspaces:", err);

      setError(err?.message || "Failed to load workspaces.");

      setWorkspaces([]);
      setActiveWorkspace(null);

      // Report failure to the caller.
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ======================================================
  // INITIAL LOAD AND AUTHENTICATION CHANGES
  // ======================================================

  useEffect(() => {
    void loadWorkspaces();

    const handleAuthenticationChange = () => {
      void loadWorkspaces();
    };

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthenticationChange);

    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthenticationChange);
    };
  }, [loadWorkspaces]);

  // ======================================================
  // SWITCH WORKSPACE AND ROLE
  // ======================================================

  const switchWorkspace = useCallback(
    (workspaceId, requestedRole = null) => {
      const selectedWorkspace = workspaces.find(
        (workspace) => String(workspace.id) === String(workspaceId),
      );

      if (!selectedWorkspace) {
        console.warn(
          "Workspace switch ignored: workspace is not available to this account.",
        );

        return;
      }

      const selectedRole = getRoleForWorkspace(
        selectedWorkspace,
        requestedRole,
      );

      if (!selectedRole) {
        console.warn(
          "Workspace switch ignored: no available role was returned for this workspace.",
        );

        return;
      }

      const resolvedWorkspace = {
        ...selectedWorkspace,
        role: selectedRole,
      };

      setActiveWorkspace(resolvedWorkspace);

      localStorage.setItem(STORAGE_KEY, String(selectedWorkspace.id));

      localStorage.setItem(
        `${ROLE_STORAGE_PREFIX}${selectedWorkspace.id}`,
        selectedRole,
      );

      window.dispatchEvent(
        new CustomEvent("zyra-workspace-changed", {
          detail: {
            workspaceId: selectedWorkspace.id,
            workspaceType:
              selectedWorkspace.type ||
              selectedWorkspace.workspace_type ||
              null,
            role: selectedRole,
          },
        }),
      );
    },
    [workspaces],
  );

  // ======================================================
  // SWITCH ROLE
  // ======================================================

  const switchRole = useCallback(
    (role) => {
      if (!activeWorkspace) {
        return;
      }

      switchWorkspace(activeWorkspace.id, role);
    },
    [activeWorkspace, switchWorkspace],
  );

  // ======================================================
  // CLEAR ACTIVE WORKSPACE
  // ======================================================

  const clearWorkspace = useCallback(() => {
    setActiveWorkspace(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // ======================================================
  // ACTIVE WORKSPACE VALUES
  // ======================================================

  const workspaceId = activeWorkspace?.id ?? null;

  const workspaceName = activeWorkspace?.name || "";

  const workspaceType =
    activeWorkspace?.type ||
    activeWorkspace?.workspace_type ||
    activeWorkspace?.workspaceType ||
    null;

  const workspaceRole = normalizeRole(activeWorkspace?.role);

  const availableRoles = useMemo(
    () => getWorkspaceRoles(activeWorkspace),
    [activeWorkspace],
  );

  // ======================================================
  // CONTEXT VALUE
  // ======================================================

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      workspaceId,
      workspaceName,
      workspaceType,
      workspaceRole,
      availableRoles,

      isAdmin: workspaceRole === "ADMIN",
      isHR: workspaceRole === "HR",
      isTeamLeader: workspaceRole === "TEAM_LEADER",
      isUser: workspaceRole === "USER",

      loading,
      error,

      switchWorkspace,
      switchWorkspaceRole: switchWorkspace,
      switchRole,
      clearWorkspace,

      // Returns true when loading succeeds, false when it fails.
      refreshWorkspaces: loadWorkspaces,
    }),
    [
      workspaces,
      activeWorkspace,
      workspaceId,
      workspaceName,
      workspaceType,
      workspaceRole,
      availableRoles,
      loading,
      error,
      switchWorkspace,
      switchRole,
      clearWorkspace,
      loadWorkspaces,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// ======================================================
// HOOK
// ======================================================

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used inside a WorkspaceProvider.");
  }

  return context;
}
