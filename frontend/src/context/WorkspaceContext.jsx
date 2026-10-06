import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMyWorkspaces } from "../services/workspaceService";

const WorkspaceContext = createContext(null);

const STORAGE_KEY = "zyra_active_workspace_id";

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadWorkspaces();
  }, []);

  async function loadWorkspaces() {
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

      if (workspaceList.length === 0) {
        setActiveWorkspace(null);
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      const savedWorkspaceId = localStorage.getItem(STORAGE_KEY);

      const savedWorkspace = workspaceList.find(
        (workspace) => String(workspace.id) === String(savedWorkspaceId),
      );

      if (savedWorkspace) {
        setActiveWorkspace(savedWorkspace);
        return;
      }

      setActiveWorkspace(workspaceList[0]);
      localStorage.setItem(STORAGE_KEY, String(workspaceList[0].id));
    } catch (err) {
      console.error("Failed to load workspaces:", err);
      setError(err?.message || "Failed to load workspaces.");
      setWorkspaces([]);
      setActiveWorkspace(null);
    } finally {
      setLoading(false);
    }
  }

  function switchWorkspace(workspaceId) {
    const selectedWorkspace = workspaces.find(
      (workspace) => String(workspace.id) === String(workspaceId),
    );

    if (!selectedWorkspace) {
      return;
    }

    setActiveWorkspace(selectedWorkspace);

    localStorage.setItem(STORAGE_KEY, String(selectedWorkspace.id));
  }

  function clearWorkspace() {
    setActiveWorkspace(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,

      workspaceId: activeWorkspace?.id || null,
      workspaceName: activeWorkspace?.name || "",
      workspaceType: activeWorkspace?.type || null,

      // IMPORTANT:
      // This role belongs to the ACTIVE WORKSPACE.
      // It is NOT users.role.
      workspaceRole: activeWorkspace?.role || null,

      isAdmin: activeWorkspace?.role === "ADMIN",
      isHR: activeWorkspace?.role === "HR",
      isTeamLeader: activeWorkspace?.role === "TEAM_LEADER",
      isUser: activeWorkspace?.role === "USER",

      loading,
      error,

      switchWorkspace,
      clearWorkspace,
      refreshWorkspaces: loadWorkspaces,
    }),
    [workspaces, activeWorkspace, loading, error],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used inside a WorkspaceProvider.");
  }

  return context;
}
