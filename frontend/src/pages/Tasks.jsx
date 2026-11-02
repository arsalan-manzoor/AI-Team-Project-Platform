import {
  CheckSquare,
  Clock3,
  CircleCheck,
  AlertCircle,
  ArrowRight,
  Activity,
  CalendarDays,
  ListFilter,
  Plus,
  FolderKanban,
  X,
  RefreshCw,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import { getTasks } from "../services/taskService";
import { getCurrentUser } from "../services/authService";
import { getTeams } from "../services/teamService";
import { apiRequest } from "../services/api";
import { useWorkspace } from "../context/WorkspaceContext";

import "../styles/tasks.css";

/* ============================================================
   RESPONSE NORMALIZATION HELPERS
============================================================ */

function normalizeCollection(response, propertyName) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.[propertyName])) {
    return response[propertyName];
  }

  if (Array.isArray(response?.data?.[propertyName])) {
    return response.data[propertyName];
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function normalizeId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

/*
 * Try the workspace fields that may already be present in
 * existing project/task API responses.
 *
 * This helper does not assume that a project belongs to a
 * workspace just because the signed-in user has access to it.
 */
function getRecordWorkspaceId(record) {
  const candidates = [
    record?.workspace_id,
    record?.workspaceId,
    record?.workspace?.id,
    record?.workspace?.workspace_id,
    record?.workspace?.workspaceId,

    record?.team_workspace_id,
    record?.teamWorkspaceId,

    record?.team?.workspace_id,
    record?.team?.workspaceId,
    record?.team?.workspace?.id,
    record?.team?.workspace?.workspace_id,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeId(candidate);

    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

function getProjectTeamId(project) {
  const candidates = [
    project?.team_id,
    project?.teamId,
    project?.team?.id,
    project?.team?.team_id,
    project?.team?.teamId,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeId(candidate);

    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

/*
 * Resolve the workspace attached to a team from the team API.
 *
 * WorkspaceContext does not always include a nested list of teams,
 * so the task page must use getTeams() instead of assuming the active
 * workspace object contains that relationship.
 */
function getTeamWorkspaceId(team) {
  const candidates = [
    team?.workspace_id,
    team?.workspaceId,
    team?.workspace?.id,
    team?.workspace?.workspace_id,
    team?.workspace?.workspaceId,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeId(candidate);

    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

function getTeamLeaderId(team) {
  return (
    team?.team_leader_id ??
    team?.teamLeaderId ??
    team?.leader_id ??
    team?.leaderId
  );
}

function getTeamCreatorId(team) {
  return (
    team?.created_by ?? team?.createdBy ?? team?.creator_id ?? team?.creatorId
  );
}

function isTeamUnderLeader(team, userId) {
  const assignedLeaderId = getTeamLeaderId(team);

  if (
    assignedLeaderId !== null &&
    assignedLeaderId !== undefined &&
    assignedLeaderId !== ""
  ) {
    return normalizeId(assignedLeaderId) === normalizeId(userId);
  }

  return normalizeId(getTeamCreatorId(team)) === normalizeId(userId);
}

/*
 * Keep projects associated with the selected workspace.
 *
 * Regular workspace members can use explicit project workspace
 * metadata, even when getTeams() does not return the project's team.
 *
 * If a project has no workspace metadata, its team relationship must
 * establish which workspace owns it.
 *
 * Team Leaders are subject to the additional team ownership check
 * when viewing projects for task creation.
 */
function filterProjectsForWorkspace(
  projects,
  workspaceId,
  teams,
  { userId = null, teamLeaderOnly = false } = {},
) {
  const expectedWorkspaceId = normalizeId(workspaceId);

  if (expectedWorkspaceId === null) {
    return [];
  }

  const allTeams = normalizeCollection(teams, "teams");

  const allTeamMap = new Map(
    allTeams
      .map((team) => [
        normalizeId(team?.id ?? team?.team_id ?? team?.teamId),
        team,
      ])
      .filter(([teamId]) => teamId !== null),
  );

  const workspaceTeams = allTeams.filter(
    (team) => getTeamWorkspaceId(team) === expectedWorkspaceId,
  );

  const workspaceTeamMap = new Map(
    workspaceTeams
      .map((team) => [
        normalizeId(team?.id ?? team?.team_id ?? team?.teamId),
        team,
      ])
      .filter(([teamId]) => teamId !== null),
  );

  return projects.filter((project) => {
    const projectWorkspaceId = getRecordWorkspaceId(project);

    /*
     * Never include a project explicitly assigned to another workspace.
     */
    if (
      projectWorkspaceId !== null &&
      projectWorkspaceId !== expectedWorkspaceId
    ) {
      return false;
    }

    const projectTeamId = getProjectTeamId(project);

    const team = projectTeamId !== null ? allTeamMap.get(projectTeamId) : null;

    /*
     * When a project's workspace is explicitly identified, regular
     * workspace filtering does not require that getTeams() also return
     * its team. This fixes the My Tasks error for project members.
     */
    if (projectWorkspaceId !== null) {
      /*
       * If both project and team relationships are available, reject
       * contradictory workspace information.
       */
      if (
        team &&
        getTeamWorkspaceId(team) !== null &&
        getTeamWorkspaceId(team) !== expectedWorkspaceId
      ) {
        return false;
      }

      /*
       * Team Leaders must still have a matching team in the selected
       * workspace and pass the existing team ownership check.
       */
      if (teamLeaderOnly) {
        const workspaceTeam =
          projectTeamId !== null ? workspaceTeamMap.get(projectTeamId) : null;

        if (!workspaceTeam) {
          return false;
        }

        if (getTeamWorkspaceId(workspaceTeam) !== expectedWorkspaceId) {
          return false;
        }

        if (!isTeamUnderLeader(workspaceTeam, userId)) {
          return false;
        }
      }

      return true;
    }

    /*
     * If a project does not identify its workspace, a matching team
     * must establish which workspace owns it.
     */
    if (projectTeamId === null) {
      return false;
    }

    const workspaceTeam = workspaceTeamMap.get(projectTeamId);

    if (!workspaceTeam) {
      return false;
    }

    if (getTeamWorkspaceId(workspaceTeam) !== expectedWorkspaceId) {
      return false;
    }

    if (teamLeaderOnly && !isTeamUnderLeader(workspaceTeam, userId)) {
      return false;
    }

    return true;
  });
}

function getTaskProjectId(task) {
  return task?.project_id ?? task?.projectId;
}

function getTaskAssigneeId(task) {
  return task?.assigned_to ?? task?.assignedTo;
}

/*
 * Resolve the original creator of a project.
 *
 * Company HR task creation is limited to projects created
 * by the same HR account.
 */
function getProjectCreatorId(project) {
  return (
    project?.created_by ??
    project?.createdBy ??
    project?.creator_id ??
    project?.creatorId ??
    project?.created_by_user_id ??
    project?.createdByUserId
  );
}

function hasTaskWorkspaceMismatch(task, workspaceId) {
  const taskWorkspaceId = getRecordWorkspaceId(task);

  return (
    taskWorkspaceId !== null && taskWorkspaceId !== normalizeId(workspaceId)
  );
}

/* ============================================================
   TASKS PAGE
============================================================ */

function Tasks() {
  const navigate = useNavigate();

  const {
    activeWorkspace,
    workspaceId,
    workspaceRole,
    loading: workspaceLoading,
  } = useWorkspace();

  /* ========================================================
     ACTIVE WORKSPACE CONTEXT
  ======================================================== */

  const normalizedWorkspaceRole = String(workspaceRole || "")
    .trim()
    .toUpperCase();

  const normalizedWorkspaceType = String(
    activeWorkspace?.type ||
      activeWorkspace?.workspace_type ||
      activeWorkspace?.workspaceType ||
      "",
  )
    .trim()
    .toUpperCase();

  const isIndividualWorkspace = normalizedWorkspaceType === "INDIVIDUAL";

  /*
   * TASK CREATION PERMISSIONS
   *
   * INDIVIDUAL:
   * TEAM_LEADER can create tasks.
   * USER cannot create tasks.
   *
   * COMPANY:
   * ADMIN can create tasks.
   * HR can create tasks in projects created by that HR.
   * TEAM_LEADER can create tasks in their own team's projects.
   * USER cannot create tasks.
   */
  const canCreateTask = isIndividualWorkspace
    ? normalizedWorkspaceRole === "TEAM_LEADER"
    : ["ADMIN", "HR", "TEAM_LEADER"].includes(normalizedWorkspaceRole);

  /*
   * Include the selected role in the context key.
   *
   * Switching workspaces OR switching roles causes the task
   * list to be reloaded.
   */
  const contextKey = [
    normalizeId(workspaceId) || "no-workspace",
    normalizedWorkspaceType || "unknown-type",
    normalizedWorkspaceRole || "no-role",
  ].join("::");

  /* ========================================================
     TASK STATE
  ======================================================== */

  const [tasks, setTasks] = useState([]);

  const [tasksContextKey, setTasksContextKey] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [activeFilter, setActiveFilter] = useState("all");

  /*
   * Never render tasks belonging to a different previously
   * loaded workspace or role.
   */
  const visibleTasks =
    !workspaceLoading && tasksContextKey === contextKey ? tasks : [];

  /* ========================================================
     PROJECT SELECTOR STATE
  ======================================================== */

  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const [projects, setProjects] = useState([]);

  const [projectPickerLoading, setProjectPickerLoading] = useState(false);

  const [projectsLoaded, setProjectsLoaded] = useState(false);

  const [projectPickerError, setProjectPickerError] = useState("");

  const projectsContextKeyRef = useRef("");

  /*
   * Increment this counter whenever a new project-loading
   * request begins or the workspace context changes.
   *
   * A response from an older workspace must not overwrite
   * the current workspace's project selector.
   */
  const projectRequestIdRef = useRef(0);

  /* ========================================================
     RESET STATE ON WORKSPACE / ROLE CHANGE
  ======================================================== */

  useEffect(() => {
    setTasks([]);
    setTasksContextKey("");

    setLoading(true);
    setError("");

    setActiveFilter("all");

    setShowProjectPicker(false);

    setProjects([]);
    setProjectsLoaded(false);

    setProjectPickerLoading(false);
    setProjectPickerError("");

    projectsContextKeyRef.current = "";

    projectRequestIdRef.current += 1;
  }, [contextKey]);

  /* ========================================================
     LOAD WORKSPACE-SCOPED ASSIGNED TASKS
  ======================================================== */

  useEffect(() => {
    let cancelled = false;

    if (workspaceLoading) {
      setTasks([]);
      setTasksContextKey("");
      setLoading(true);

      return () => {
        cancelled = true;
      };
    }

    async function loadTasks() {
      try {
        setTasks([]);
        setTasksContextKey("");
        setLoading(true);
        setError("");

        if (!workspaceId) {
          setError("No active workspace was found.");
          return;
        }

        /*
         * Retrieve the task collection and signed-in user.
         */
        const [tasksData, userData] = await Promise.all([
          getTasks(),
          getCurrentUser(),
        ]);

        if (cancelled) {
          return;
        }

        const loadedTasks = normalizeCollection(tasksData, "tasks");

        const currentUser = userData?.user || userData?.data?.user || userData;

        if (currentUser?.id === null || currentUser?.id === undefined) {
          throw new Error("Unable to identify the signed-in user.");
        }

        let workspaceProjects = [];

        if (isIndividualWorkspace) {
          /*
           * IMPORTANT:
           *
           * TEAM_LEADER:
           * Uses /projects because the Team Leader is allowed to
           * view projects in the Individual workspace.
           *
           * USER:
           * Uses /my-assigned-projects because this endpoint is
           * intentionally restricted to Individual USER members.
           */
          let projectData;

          if (normalizedWorkspaceRole === "TEAM_LEADER") {
            projectData = await apiRequest(
              `/workspaces/individual/${encodeURIComponent(
                workspaceId,
              )}/projects`,
            );
          } else if (normalizedWorkspaceRole === "USER") {
            projectData = await apiRequest(
              `/workspaces/individual/${encodeURIComponent(
                workspaceId,
              )}/my-assigned-projects`,
            );
          } else {
            throw new Error(
              "Your role is not authorized to access Individual workspace tasks.",
            );
          }

          if (cancelled) {
            return;
          }

          workspaceProjects = normalizeCollection(
            projectData,
            "projects",
          ).filter((project) => {
            const projectWorkspaceId = getRecordWorkspaceId(project);

            return (
              projectWorkspaceId === null ||
              projectWorkspaceId === normalizeId(workspaceId)
            );
          });
        } else {
          /*
           * Company workspace:
           *
           * Load project and team metadata to identify projects
           * belonging to the active workspace.
           */
          const [projectData, teamData] = await Promise.all([
            apiRequest("/projects"),
            getTeams(),
          ]);

          if (cancelled) {
            return;
          }

          const allProjects = normalizeCollection(projectData, "projects");

          const activeTeams = normalizeCollection(teamData, "teams");

          workspaceProjects = filterProjectsForWorkspace(
            allProjects,
            workspaceId,
            activeTeams,
            {
              userId: currentUser.id,
              teamLeaderOnly: normalizedWorkspaceRole === "TEAM_LEADER",
            },
          );

          if (allProjects.length > 0 && workspaceProjects.length === 0) {
            throw new Error(
              "Unable to match these projects to a team in the selected workspace. The task list has been cleared to prevent data from another workspace from appearing.",
            );
          }
        }

        if (cancelled) {
          return;
        }

        /*
         * Build the project ID list for the active workspace.
         */
        const workspaceProjectIds = new Set(
          workspaceProjects
            .map(
              (project) =>
                project?.id ?? project?.project_id ?? project?.projectId,
            )
            .filter((id) => id !== null && id !== undefined && id !== "")
            .map((id) => String(id)),
        );

        /*
         * MY TASKS FILTER
         *
         * This is deliberately based on assigned_to.
         *
         * It does NOT use created_by.
         *
         * Therefore:
         * - Tasks assigned to the Team Leader appear.
         * - Tasks created by the Team Leader but assigned to Users
         *   do not appear in the Team Leader's My Tasks.
         * - Tasks assigned to other Users do not appear here.
         */
        const userTasks = loadedTasks.filter((task) => {
          const assignedTo = getTaskAssigneeId(task);

          const projectId = getTaskProjectId(task);

          /*
           * Only tasks assigned to the currently signed-in account.
           */
          if (
            assignedTo === null ||
            assignedTo === undefined ||
            Number(assignedTo) !== Number(currentUser.id)
          ) {
            return false;
          }

          if (
            projectId === null ||
            projectId === undefined ||
            projectId === ""
          ) {
            return false;
          }

          /*
           * Reject a task that explicitly identifies another workspace.
           */
          if (hasTaskWorkspaceMismatch(task, workspaceId)) {
            return false;
          }

          /*
           * The task's project must belong to the active workspace.
           */
          return workspaceProjectIds.has(String(projectId));
        });

        if (cancelled) {
          return;
        }

        setTasks(userTasks);
        setTasksContextKey(contextKey);
      } catch (requestError) {
        console.error("Tasks loading error:", requestError);

        if (!cancelled) {
          setTasks([]);
          setTasksContextKey("");

          setError(
            requestError.message || "Failed to load your assigned tasks.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTasks();

    return () => {
      cancelled = true;
    };
  }, [
    contextKey,
    workspaceId,
    workspaceLoading,
    isIndividualWorkspace,
    normalizedWorkspaceRole,
  ]);

  /* ========================================================
     LOAD PROJECTS FOR TASK CREATION
     ROLE-BASED PROJECT ACCESS
  ======================================================== */

  const handleOpenCreateTask = useCallback(async () => {
    if (!canCreateTask || !workspaceId) {
      setShowProjectPicker(false);
      return;
    }

    setShowProjectPicker(true);
    setProjectPickerError("");

    const expectedContextKey = contextKey;

    /*
     * Reuse the cache only if it belongs to the currently
     * selected workspace and role.
     */
    if (
      projectsLoaded &&
      projectsContextKeyRef.current === expectedContextKey
    ) {
      return;
    }

    if (projectPickerLoading) {
      return;
    }

    const requestId = ++projectRequestIdRef.current;

    try {
      setProjectPickerLoading(true);
      setProjectPickerError("");

      const [currentUserResponse, teamsResponse] = await Promise.all([
        getCurrentUser(),
        getTeams(),
      ]);

      const currentUser =
        currentUserResponse?.user ||
        currentUserResponse?.data?.user ||
        currentUserResponse;

      if (currentUser?.id === null || currentUser?.id === undefined) {
        throw new Error("Unable to identify the signed-in user.");
      }

      const activeTeams = normalizeCollection(teamsResponse, "teams");

      let allProjects = [];

      if (isIndividualWorkspace) {
        const response = await apiRequest(
          `/workspaces/individual/${encodeURIComponent(workspaceId)}/projects`,
        );

        allProjects = normalizeCollection(response, "projects");
      } else {
        const response = await apiRequest("/projects");

        allProjects = normalizeCollection(response, "projects");
      }

      /*
       * Ignore responses from an old workspace or role.
       */
      if (
        requestId !== projectRequestIdRef.current ||
        expectedContextKey !== contextKey
      ) {
        return;
      }

      let availableProjects = filterProjectsForWorkspace(
        allProjects,
        workspaceId,
        activeTeams,
        {
          userId: currentUser.id,
          teamLeaderOnly: normalizedWorkspaceRole === "TEAM_LEADER",
        },
      );

      /*
       * COMPANY HR RULE:
       *
       * HR can create tasks only in projects originally
       * created by that same HR account.
       *
       * Projects created by ADMIN and merely assigned to HR
       * are not included by this filter.
       */
      if (!isIndividualWorkspace && normalizedWorkspaceRole === "HR") {
        availableProjects = availableProjects.filter(
          (project) =>
            normalizeId(getProjectCreatorId(project)) ===
            normalizeId(currentUser.id),
        );
      }

      if (allProjects.length > 0 && availableProjects.length === 0) {
        throw new Error(
          "No projects are available for task creation under your current role and project permissions.",
        );
      }

      if (
        requestId !== projectRequestIdRef.current ||
        expectedContextKey !== contextKey
      ) {
        return;
      }

      setProjects(availableProjects);

      setProjectsLoaded(true);

      projectsContextKeyRef.current = expectedContextKey;
    } catch (requestError) {
      if (
        requestId !== projectRequestIdRef.current ||
        expectedContextKey !== contextKey
      ) {
        return;
      }

      console.error("Failed to load projects for task creation:", requestError);

      setProjects([]);
      setProjectsLoaded(false);

      setProjectPickerError(
        requestError.message ||
          "Unable to load your workspace projects. Please try again.",
      );
    } finally {
      if (requestId === projectRequestIdRef.current) {
        setProjectPickerLoading(false);
      }
    }
  }, [
    canCreateTask,
    workspaceId,
    contextKey,
    projectsLoaded,
    projectPickerLoading,
    isIndividualWorkspace,
    normalizedWorkspaceRole,
  ]);

  /* ========================================================
     SELECT A PROJECT
  ======================================================== */

  function handleSelectProject(project) {
    if (!canCreateTask) {
      setShowProjectPicker(false);
      return;
    }

    if (!project?.id) {
      setProjectPickerError(
        "This project is missing its ID. Please select another project.",
      );

      return;
    }

    /*
     * Do not navigate using a project cached from a previous
     * workspace context.
     */
    if (projectsContextKeyRef.current !== contextKey) {
      setProjectPickerError(
        "Your workspace changed. Reload the project list before selecting a project.",
      );

      setProjects([]);
      setProjectsLoaded(false);

      return;
    }

    setShowProjectPicker(false);

    navigate(`/projects/${encodeURIComponent(project.id)}/tasks/create`);
  }

  /* ========================================================
     TASK STATUS HELPERS
  ======================================================== */

  const isCompleted = (task) => {
    const status = String(task.status || "")
      .trim()
      .toLowerCase();

    return ["completed", "complete", "done"].includes(status);
  };

  const isInProgress = (task) => {
    const status = String(task.status || "")
      .toLowerCase()
      .replace(/-/g, "_")
      .replace(/\s+/g, "_");

    return status === "in_progress";
  };

  const isOverdue = (task) => {
    if (!task.deadline || isCompleted(task)) {
      return false;
    }

    const deadline = new Date(task.deadline);

    const today = new Date();

    if (Number.isNaN(deadline.getTime())) {
      return false;
    }

    deadline.setHours(23, 59, 59, 999);

    return deadline < today;
  };

  /* ========================================================
     DERIVED TASK COLLECTIONS
  ======================================================== */

  const inProgressTasks = useMemo(
    () => visibleTasks.filter(isInProgress),
    [visibleTasks],
  );

  const completedTasks = useMemo(
    () => visibleTasks.filter(isCompleted),
    [visibleTasks],
  );

  const overdueTasks = useMemo(
    () => visibleTasks.filter(isOverdue),
    [visibleTasks],
  );

  const pendingTasks = useMemo(
    () =>
      visibleTasks.filter((task) => !isCompleted(task) && !isInProgress(task)),
    [visibleTasks],
  );

  /* ========================================================
     FILTER TASKS
  ======================================================== */

  const filteredTasks = useMemo(() => {
    switch (activeFilter) {
      case "in_progress":
        return inProgressTasks;

      case "completed":
        return completedTasks;

      case "overdue":
        return overdueTasks;

      default:
        return visibleTasks;
    }
  }, [
    activeFilter,
    visibleTasks,
    inProgressTasks,
    completedTasks,
    overdueTasks,
  ]);

  /* ========================================================
     DISPLAY HELPERS
  ======================================================== */

  function getDisplayStatus(status) {
    const normalizedStatus = String(status || "")
      .toLowerCase()
      .replace(/-/g, "_")
      .replace(/\s+/g, "_");

    switch (normalizedStatus) {
      case "in_progress":
        return "In Progress";

      case "in_review":
        return "In Review";

      case "completed":
      case "complete":
      case "done":
        return "Completed";

      case "pending":
      case "todo":
      case "to_do":
        return "Pending";

      default:
        return status || "Pending";
    }
  }

  function getTaskStatusClass(task) {
    if (isOverdue(task)) {
      return "overdue";
    }

    if (isCompleted(task)) {
      return "completed";
    }

    if (isInProgress(task)) {
      return "in-progress";
    }

    return "pending";
  }

  function formatDeadline(deadline) {
    if (!deadline) {
      return null;
    }

    const date = new Date(deadline);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  }

  /* ========================================================
     OPEN TASK DETAILS
  ======================================================== */

  function openTaskDetails(task) {
    const projectId = getTaskProjectId(task);

    const taskId = task?.id ?? task?.task_id;

    if (
      projectId === null ||
      projectId === undefined ||
      taskId === null ||
      taskId === undefined
    ) {
      setError("This task is missing its project or task information.");

      return;
    }

    navigate(
      `/projects/${encodeURIComponent(
        projectId,
      )}/tasks/${encodeURIComponent(taskId)}`,
    );
  }

  /* ========================================================
     TASK STATUS DISTRIBUTION
  ======================================================== */

  const statusDistribution = [
    {
      label: "In Progress",
      value: inProgressTasks.length,
      className: "active",
    },
    {
      label: "Pending",
      value: pendingTasks.length,
      className: "pending",
    },
    {
      label: "Completed",
      value: completedTasks.length,
      className: "completed",
    },
    {
      label: "Overdue",
      value: overdueTasks.length,
      className: "overdue",
    },
  ];

  /* ========================================================
     RENDER
  ======================================================== */

  return (
    <div className="zyra-tasks">
      {/* PAGE HEADER */}

      <div className="tasks-header">
        <div className="tasks-header-main">
          <p className="tasks-eyebrow">ZYRA / TASK WORKSPACE</p>

          <div className="tasks-title-row">
            <h2>My Tasks</h2>

            <span className="tasks-title-divider" />

            <div className="tasks-welcome">
              <strong>Your Work Queue</strong>

              <span>Assigned tasks across your projects</span>
            </div>
          </div>

          <p className="tasks-subtitle">
            Stay on top of your assigned work and track what needs your
            attention.
          </p>
        </div>

        {/* HEADER ACTIONS */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          {canCreateTask && (
            <button
              type="button"
              onClick={handleOpenCreateTask}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                minHeight: 42,
                padding: "11px 17px",
                border: "1px solid rgba(129, 114, 246, 0.8)",
                borderRadius: 10,
                background: "linear-gradient(135deg, #8172f6, #6555d9)",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 650,
                cursor: "pointer",
                boxShadow: "0 6px 20px rgba(101, 85, 217, 0.18)",
              }}
            >
              <Plus size={17} />
              Create Task
            </button>
          )}

          <div className="tasks-header-status">
            <span className="tasks-live-dot" />
            <span>WORKSPACE ACTIVE</span>
          </div>
        </div>
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      {/* TASK SUMMARY */}

      <div className="tasks-summary">
        <div className="task-summary-card">
          <div className="task-summary-icon">
            <CheckSquare size={18} />
          </div>

          <div className="task-summary-content">
            <span>Total Tasks</span>
            <strong>{loading ? "..." : visibleTasks.length}</strong>
          </div>

          <div className="task-summary-meta">
            <Activity size={13} />
            <span>WORKLOAD</span>
          </div>
        </div>

        <div className="task-summary-card">
          <div className="task-summary-icon">
            <Clock3 size={18} />
          </div>

          <div className="task-summary-content">
            <span>In Progress</span>
            <strong>{loading ? "..." : inProgressTasks.length}</strong>
          </div>

          <div className="task-summary-meta">
            <Activity size={13} />
            <span>ACTIVE</span>
          </div>
        </div>

        <div className="task-summary-card">
          <div className="task-summary-icon">
            <CircleCheck size={18} />
          </div>

          <div className="task-summary-content">
            <span>Completed</span>
            <strong>{loading ? "..." : completedTasks.length}</strong>
          </div>

          <div className="task-summary-meta">
            <CircleCheck size={13} />
            <span>DONE</span>
          </div>
        </div>

        <div className="task-summary-card">
          <div className="task-summary-icon">
            <AlertCircle size={18} />
          </div>

          <div className="task-summary-content">
            <span>Overdue</span>
            <strong>{loading ? "..." : overdueTasks.length}</strong>
          </div>

          <div className="task-summary-meta">
            <AlertCircle size={13} />
            <span>ATTENTION</span>
          </div>
        </div>
      </div>

      {/* TASK WORKSPACE */}

      <div className="tasks-workspace">
        <section className="tasks-panel tasks-active-panel">
          <div className="tasks-panel-header">
            <div>
              <div className="tasks-section-label">
                <span className="section-live-dot" />
                ACTIVE WORK
              </div>

              <h3>
                {activeFilter === "all"
                  ? `Your Tasks (${visibleTasks.length})`
                  : `${getDisplayStatus(
                      activeFilter,
                    )} (${filteredTasks.length})`}
              </h3>
            </div>

            <div className="task-filter-group">
              <button
                type="button"
                className={
                  activeFilter === "all" ? "task-filter active" : "task-filter"
                }
                onClick={() => setActiveFilter("all")}
              >
                All
              </button>

              <button
                type="button"
                className={
                  activeFilter === "in_progress"
                    ? "task-filter active"
                    : "task-filter"
                }
                onClick={() => setActiveFilter("in_progress")}
              >
                Active
              </button>

              <button
                type="button"
                className={
                  activeFilter === "completed"
                    ? "task-filter active"
                    : "task-filter"
                }
                onClick={() => setActiveFilter("completed")}
              >
                Completed
              </button>

              <button
                type="button"
                className={
                  activeFilter === "overdue"
                    ? "task-filter active"
                    : "task-filter"
                }
                onClick={() => setActiveFilter("overdue")}
              >
                Overdue
              </button>
            </div>
          </div>

          {/* LOADING */}

          {loading || workspaceLoading ? (
            <div className="tasks-empty">
              <div className="tasks-empty-icon">
                <CheckSquare size={27} />
              </div>

              <h3>Loading your workspace...</h3>

              <p>Getting your assigned tasks from the ZYRA workspace.</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            /* EMPTY TASK LIST */

            <div className="tasks-empty">
              <div className="tasks-empty-icon">
                <CheckSquare size={27} />
              </div>

              <h3>
                {activeFilter === "all"
                  ? "No tasks assigned"
                  : "No tasks in this view"}
              </h3>

              <p>
                {activeFilter === "all"
                  ? "Your assigned tasks will appear here when you start working on a project with your team."
                  : "There are currently no tasks matching this status."}
              </p>

              {activeFilter === "all" && canCreateTask && (
                <button
                  type="button"
                  onClick={handleOpenCreateTask}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 16,
                    padding: "10px 15px",
                    border: "1px solid rgba(129, 114, 246, 0.65)",
                    borderRadius: 9,
                    background: "rgba(129, 114, 246, 0.12)",
                    color: "#c8c0ff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={16} />
                  Create Your First Task
                </button>
              )}
            </div>
          ) : (
            /* TASK CARDS */

            <div className="task-list">
              {filteredTasks.map((task) => {
                const statusClass = getTaskStatusClass(task);

                const deadline = formatDeadline(task.deadline);

                const taskId = task.id ?? task.task_id;

                const projectId = getTaskProjectId(task);

                return (
                  <article
                    className={`task-card task-card-${statusClass}`}
                    key={taskId}
                    onClick={() => openTaskDetails(task)}
                  >
                    <div className="task-card-top">
                      <span className="task-project-tag">
                        PROJECT #{projectId}
                      </span>

                      <button
                        type="button"
                        className="task-card-menu"
                        aria-label="Open task"
                        onClick={(event) => {
                          event.stopPropagation();
                          openTaskDetails(task);
                        }}
                      >
                        <ArrowRight size={15} />
                      </button>
                    </div>

                    <div className="task-card-body">
                      <h3>{task.title || task.name || "Untitled task"}</h3>

                      <p>{task.description || "No description provided."}</p>
                    </div>

                    <div className="task-card-footer">
                      <span className={`task-status-pill ${statusClass}`}>
                        <span className="status-dot" />

                        {isOverdue(task)
                          ? "Overdue"
                          : getDisplayStatus(task.status)}
                      </span>

                      {deadline && (
                        <span className="task-deadline">
                          <CalendarDays size={12} />
                          {deadline}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* STATUS DISTRIBUTION */}

        <aside className="task-status-panel">
          <div className="task-status-header">
            <div>
              <span className="tasks-section-label">TASK STATUS</span>

              <h3>Distribution</h3>
            </div>

            <ListFilter size={16} />
          </div>

          <div className="task-status-total">
            <strong>{loading ? "..." : visibleTasks.length}</strong>

            <span>Total assigned</span>
          </div>

          <div className="task-status-list">
            {statusDistribution.map((status) => {
              const percentage =
                visibleTasks.length > 0
                  ? Math.round((status.value / visibleTasks.length) * 100)
                  : 0;

              return (
                <div className="task-status-row" key={status.label}>
                  <div className="task-status-row-top">
                    <span>{status.label}</span>
                    <strong>{status.value}</strong>
                  </div>

                  <div className="task-status-track">
                    <span
                      className={`task-status-bar ${status.className}`}
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  </div>

                  <span className="task-status-percentage">{percentage}%</span>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* RECENT TASKS */}

      {!loading && visibleTasks.length > 0 && (
        <section className="tasks-recent-panel">
          <div className="tasks-recent-header">
            <div>
              <span className="tasks-section-label">TASK QUEUE</span>

              <h3>More Assigned Tasks</h3>
            </div>

            <span className="tasks-recent-count">
              {visibleTasks.length} TASKS
            </span>
          </div>

          <div className="tasks-recent-grid">
            {visibleTasks.slice(0, 3).map((task) => {
              const statusClass = getTaskStatusClass(task);

              const taskId = task.id ?? task.task_id;

              const projectId = getTaskProjectId(task);

              return (
                <button
                  type="button"
                  className={`recent-task-card ${statusClass}`}
                  key={taskId}
                  onClick={() => openTaskDetails(task)}
                >
                  <div className="recent-task-accent" />

                  <div>
                    <span className="recent-task-project">
                      PROJECT #{projectId}
                    </span>

                    <h4>{task.title || task.name || "Untitled task"}</h4>

                    <span className="recent-task-status">
                      {isOverdue(task)
                        ? "Overdue"
                        : getDisplayStatus(task.status)}
                    </span>
                  </div>

                  <ArrowRight size={16} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ==================================================
          CREATE TASK: PROJECT SELECTOR
          ROLE-BASED ACCESS
      ================================================== */}

      {canCreateTask && showProjectPicker && (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowProjectPicker(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(3, 7, 14, 0.78)",
            backdropFilter: "blur(8px)",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-task-dialog-title"
            style={{
              width: "100%",
              maxWidth: 540,
              maxHeight: "85%",
              overflowY: "auto",
              padding: 26,
              border: "1px solid rgba(129, 114, 246, 0.28)",
              borderRadius: 18,
              background: "linear-gradient(145deg, #151b27, #0c111a)",
              boxShadow: "0 24px 80px rgba(0, 0, 0, 0.45)",
              color: "#f3f4f6",
            }}
          >
            {/* DIALOG HEADER */}

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 15,
                marginBottom: 22,
              }}
            >
              <div>
                <span
                  style={{
                    color: "#a99cff",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "1.7px",
                  }}
                >
                  TASK CREATION
                </span>

                <h2
                  id="create-task-dialog-title"
                  style={{
                    margin: "9px 0 8px",
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  Choose a project
                </h2>

                <p
                  style={{
                    margin: 0,
                    color: "#9ba8ba",
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  Select the project where you want to create your task.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close project selector"
                onClick={() => setShowProjectPicker(false)}
                style={{
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 9,
                  background: "rgba(255,255,255,0.04)",
                  color: "#d1d5db",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* LOADING PROJECTS */}

            {projectPickerLoading && (
              <div
                style={{
                  padding: "30px 12px",
                  textAlign: "center",
                  color: "#aeb8c7",
                }}
              >
                <RefreshCw
                  size={24}
                  className="tasks-project-picker-spin"
                  style={{
                    marginBottom: 12,
                  }}
                />

                <p>Loading your projects...</p>
              </div>
            )}

            {/* PROJECT LOADING ERROR */}

            {!projectPickerLoading && projectPickerError && (
              <div
                role="alert"
                style={{
                  padding: 15,
                  border: "1px solid rgba(248, 113, 113, 0.25)",
                  borderRadius: 10,
                  background: "rgba(248, 113, 113, 0.07)",
                  color: "#fca5a5",
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                <p>{projectPickerError}</p>

                <button
                  type="button"
                  onClick={() => {
                    setProjectsLoaded(false);

                    projectsContextKeyRef.current = "";

                    handleOpenCreateTask();
                  }}
                  style={{
                    marginTop: 8,
                    padding: "9px 13px",
                    border: "1px solid rgba(248,113,113,0.35)",
                    borderRadius: 8,
                    background: "transparent",
                    color: "#fecaca",
                    cursor: "pointer",
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {/* PROJECT LIST */}

            {!projectPickerLoading &&
              !projectPickerError &&
              projects.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                  }}
                >
                  {projects.map((project) => (
                    <button
                      type="button"
                      key={project.id}
                      onClick={() => handleSelectProject(project)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 13,
                        width: "100%",
                        padding: 15,
                        border: "1px solid rgba(255,255,255,0.09)",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.025)",
                        color: "#f3f4f6",
                        textAlign: "left",
                        cursor: "pointer",
                        transition:
                          "border-color 160ms ease, background 160ms ease",
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.borderColor =
                          "rgba(129,114,246,0.65)";

                        event.currentTarget.style.background =
                          "rgba(129,114,246,0.08)";
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.borderColor =
                          "rgba(255,255,255,0.09)";

                        event.currentTarget.style.background =
                          "rgba(255,255,255,0.025)";
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          placeItems: "center",
                          width: 42,
                          height: 42,
                          flexShrink: 0,
                          border: "1px solid rgba(129,114,246,0.2)",
                          borderRadius: 10,
                          background: "rgba(129,114,246,0.12)",
                          color: "#a99cff",
                        }}
                      >
                        <FolderKanban size={20} />
                      </div>

                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <strong
                          style={{
                            display: "block",
                            marginBottom: 5,
                            overflowWrap: "anywhere",
                            fontSize: 14,
                          }}
                        >
                          {project.name || `Project #${project.id}`}
                        </strong>

                        <span
                          style={{
                            display: "block",
                            color: "#9ba8ba",
                            fontSize: 12,
                            lineHeight: 1.5,
                          }}
                        >
                          {project.description ||
                            "Create and organize project tasks"}
                        </span>
                      </div>

                      <ArrowRight
                        size={18}
                        style={{
                          flexShrink: 0,
                          color: "#a99cff",
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}

            {/* NO PROJECTS */}

            {!projectPickerLoading &&
              !projectPickerError &&
              projectsLoaded &&
              projects.length === 0 && (
                <div
                  style={{
                    padding: "25px 10px",
                    textAlign: "center",
                  }}
                >
                  <FolderKanban
                    size={32}
                    style={{
                      marginBottom: 12,
                      color: "#a99cff",
                    }}
                  />

                  <h3
                    style={{
                      margin: "0 0 8px",
                      fontSize: 16,
                    }}
                  >
                    No projects available
                  </h3>

                  <p
                    style={{
                      color: "#9ba8ba",
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    Create or join a project first, then return here to create a
                    task within that project.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProjectPicker(false);
                      navigate("/projects");
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 12,
                      padding: "11px 16px",
                      border: "1px solid rgba(129,114,246,0.5)",
                      borderRadius: 9,
                      background: "rgba(129,114,246,0.12)",
                      color: "#c8c0ff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Open My Projects
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}

            {/* DIALOG FOOTER */}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 22,
                paddingTop: 17,
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <button
                type="button"
                onClick={() => setShowProjectPicker(false)}
                style={{
                  padding: "10px 16px",
                  border: "1px solid rgba(255,255,255,0.13)",
                  borderRadius: 9,
                  background: "transparent",
                  color: "#cbd5e1",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Tasks;
