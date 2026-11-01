import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckSquare,
  Clock3,
  FolderKanban,
  Plus,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

import { getProjects } from "../services/ProjectService.js";
import { getCurrentUser } from "../services/authService.js";
import { getTeams } from "../services/teamService.js";
import { getTasks } from "../services/taskService.js";
import { apiRequest } from "../services/api";
import { useWorkspace } from "../context/WorkspaceContext.jsx";

import "../styles/UserDash.css";

// ========================================================
// CONSTANTS
// ========================================================

const STATUS_DONE = new Set(["completed", "complete", "done"]);

const STATUS_ACTIVE = new Set([
  "in_progress",
  "in progress",
  "active",
  "working",
]);

const PRIORITY_ORDER = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ========================================================
// DATA HELPERS
// ========================================================

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.projects)) return value.projects;
  if (Array.isArray(value?.tasks)) return value.tasks;
  if (Array.isArray(value?.teams)) return value.teams;

  return [];
}

function getId(item) {
  return item?.id ?? item?.task_id ?? item?.project_id ?? item?.team_id;
}

function getDueDate(task) {
  const value =
    task?.deadline ?? task?.due_date ?? task?.dueDate ?? task?.due_at;

  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isCompleted(task) {
  return STATUS_DONE.has(
    String(task?.status || "")
      .trim()
      .toLowerCase(),
  );
}

function getStatus(task) {
  const raw = String(task?.status || "todo")
    .trim()
    .toLowerCase();

  if (STATUS_DONE.has(raw)) return "Completed";

  if (STATUS_ACTIVE.has(raw)) return "In Progress";

  if (raw === "pending" || raw === "todo" || raw === "to do") {
    return "To Do";
  }

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (character) => character.toUpperCase());
}

function isOverdue(task) {
  const due = getDueDate(task);

  if (!due || isCompleted(task)) return false;

  const endOfDueDay = new Date(due);
  endOfDueDay.setHours(23, 59, 59, 999);

  return endOfDueDay < new Date();
}

function formatDueDate(task, includeTime = false) {
  const due = getDueDate(task);

  if (!due) return "No due date";

  const now = new Date();
  const tomorrow = new Date(now);

  tomorrow.setDate(now.getDate() + 1);

  const isToday = due.toDateString() === now.toDateString();
  const isTomorrow = due.toDateString() === tomorrow.toDateString();

  let label = isToday
    ? "Today"
    : isTomorrow
      ? "Tomorrow"
      : due.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        });

  const rawDate =
    task?.deadline ?? task?.due_date ?? task?.dueDate ?? task?.due_at;

  const hasTime =
    typeof rawDate === "string" &&
    /T\d{2}:\d{2}|\d{2}:\d{2}:\d{2}/.test(rawDate);

  if (includeTime && hasTime) {
    label += `, ${due.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return label;
}

function getPriority(task) {
  return String(task?.priority || "medium")
    .trim()
    .toLowerCase();
}

function getPriorityLabel(task) {
  const priority = getPriority(task);

  if (priority === "urgent") return "Urgent";

  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function sortTasks(tasks) {
  return [...tasks].sort((first, second) => {
    const overdueDifference =
      Number(isOverdue(second)) - Number(isOverdue(first));

    if (overdueDifference !== 0) return overdueDifference;

    const priorityDifference =
      (PRIORITY_ORDER[getPriority(first)] ?? 2) -
      (PRIORITY_ORDER[getPriority(second)] ?? 2);

    if (priorityDifference !== 0) return priorityDifference;

    const firstDue = getDueDate(first)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const secondDue = getDueDate(second)?.getTime() ?? Number.MAX_SAFE_INTEGER;

    return firstDue - secondDue;
  });
}

function isProjectCompleted(project) {
  const status = String(project?.status || "")
    .trim()
    .toLowerCase();

  return STATUS_DONE.has(status);
}

function getProjectStatus(project) {
  const status = String(project?.status || "planned")
    .trim()
    .toLowerCase();

  if (STATUS_DONE.has(status)) return "Completed";
  if (STATUS_ACTIVE.has(status)) return "In Progress";

  return status
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (character) => character.toUpperCase());
}

function getProjectProgress(project, tasks) {
  const projectTasks = tasks.filter(
    (task) => Number(task.project_id) === Number(getId(project)),
  );

  if (projectTasks.length === 0) {
    return isProjectCompleted(project) ? 100 : 0;
  }

  const completed = projectTasks.filter(isCompleted).length;

  return Math.round((completed / projectTasks.length) * 100);
}

// ========================================================
// USER DASHBOARD
// ========================================================

function UserDash() {
  const navigate = useNavigate();

  const {
    activeWorkspace,
    workspaceId,
    workspaceName,
    workspaceRole,
    loading: workspaceLoading,
  } = useWorkspace();

  // Normalize the active workspace's details.
  const activeWorkspaceType = String(activeWorkspace?.type || "")
    .trim()
    .toUpperCase();

  const activeMembershipRole = String(
    workspaceRole || activeWorkspace?.role || "",
  )
    .trim()
    .toUpperCase();

  // Only Individual USER memberships use the assigned-projects endpoint.
  const isIndividualUser =
    activeWorkspaceType === "INDIVIDUAL" && activeMembershipRole === "USER";

  // ------------------------------------------------------
  // STATE
  // ------------------------------------------------------

  const [user, setUser] = useState(null);

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [teams, setTeams] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ------------------------------------------------------
  // LOAD DASHBOARD DATA
  // ------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (workspaceLoading) return;

      setLoading(true);
      setError("");

      // IMPORTANT:
      //
      // Individual USER:
      // Load projects associated with accepted invitations.
      //
      // Other workspace types and roles:
      // Preserve the existing getProjects() behavior.
      //
      // The backend assigned-projects endpoint must exist for the
      // Individual USER path to work.
      const projectsRequest =
        workspaceId && isIndividualUser
          ? apiRequest(
              `/workspaces/individual/${encodeURIComponent(
                workspaceId,
              )}/my-assigned-projects`,
            )
          : workspaceId
            ? getProjects()
            : Promise.resolve([]);

      const tasksRequest = workspaceId ? getTasks() : Promise.resolve([]);

      const teamsRequest = workspaceId ? getTeams() : Promise.resolve([]);

      const [userResult, projectsResult, tasksResult, teamsResult] =
        await Promise.allSettled([
          getCurrentUser(),
          projectsRequest,
          tasksRequest,
          teamsRequest,
        ]);

      if (cancelled) return;

      // ----------------------------------------------------
      // CURRENT ACCOUNT
      // ----------------------------------------------------

      let currentUser = null;

      if (userResult.status === "fulfilled") {
        currentUser =
          userResult.value?.user ||
          userResult.value?.data?.user ||
          userResult.value;

        setUser(currentUser || null);
      } else {
        setUser(null);

        setError(userResult.reason?.message || "Unable to load your account.");
      }

      // ----------------------------------------------------
      // ACCOUNT WITHOUT A WORKSPACE
      // ----------------------------------------------------

      if (!workspaceId) {
        setProjects([]);
        setTasks([]);
        setMyTasks([]);
        setTeams([]);
        setLoading(false);

        return;
      }

      // ----------------------------------------------------
      // PROJECTS, TASKS AND TEAMS
      // ----------------------------------------------------

      const allProjects =
        projectsResult.status === "fulfilled"
          ? asArray(projectsResult.value)
          : [];

      const allTasks =
        tasksResult.status === "fulfilled" ? asArray(tasksResult.value) : [];

      const allTeams =
        teamsResult.status === "fulfilled" ? asArray(teamsResult.value) : [];

      // ----------------------------------------------------
      // FILTER THE ACTIVE WORKSPACE'S TEAMS
      // ----------------------------------------------------

      const workspaceTeams = allTeams.filter(
        (team) => Number(team.workspace_id) === Number(workspaceId),
      );

      const workspaceTeamIds = new Set(
        workspaceTeams.map((team) => Number(getId(team))),
      );

      // ----------------------------------------------------
      // FILTER THE ACTIVE WORKSPACE'S PROJECTS
      // ----------------------------------------------------
      //
      // For an Individual USER, allProjects already comes from
      // the backend assigned-projects endpoint.
      //
      // We retain the workspace filter as an additional check.
      // There is deliberately no fallback to getProjects() if
      // the assigned-projects request fails.
      // ----------------------------------------------------

      const workspaceProjects = allProjects.filter((project) => {
        if (
          project.workspace_id !== undefined &&
          project.workspace_id !== null
        ) {
          return Number(project.workspace_id) === Number(workspaceId);
        }

        return (
          project.team_id !== undefined &&
          workspaceTeamIds.has(Number(project.team_id))
        );
      });

      const projectIds = new Set(
        workspaceProjects.map((project) => Number(getId(project))),
      );

      // ----------------------------------------------------
      // KEEP TASKS RELATED TO THE VISIBLE PROJECTS
      // ----------------------------------------------------

      const workspaceTasks = allTasks.filter((task) =>
        projectIds.has(Number(task.project_id)),
      );

      // The task summary displays tasks assigned to this account.
      const assignedTasks = workspaceTasks.filter(
        (task) =>
          task.assigned_to !== undefined &&
          task.assigned_to !== null &&
          Number(task.assigned_to) === Number(currentUser?.id),
      );

      setProjects(workspaceProjects);
      setTasks(workspaceTasks);
      setMyTasks(sortTasks(assignedTasks));
      setTeams(workspaceTeams);

      // ----------------------------------------------------
      // LOADING ERRORS
      // ----------------------------------------------------

      if (
        projectsResult.status !== "fulfilled" ||
        tasksResult.status !== "fulfilled"
      ) {
        const projectError =
          projectsResult.status === "rejected"
            ? projectsResult.reason?.message
            : "";

        const taskError =
          tasksResult.status === "rejected" ? tasksResult.reason?.message : "";

        if (isIndividualUser && projectError) {
          setError(`Unable to load your assigned projects. ${projectError}`);
        } else {
          setError(
            "Some workspace information could not be loaded. Refresh the page to try again.",
          );
        }

        console.error("User Dashboard data loading details:", {
          projects: projectError || null,
          tasks: taskError || null,
          teams:
            teamsResult.status === "rejected"
              ? teamsResult.reason?.message
              : null,
        });
      }

      setLoading(false);
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, workspaceLoading, isIndividualUser]);

  // ======================================================
  // NAVIGATION ACTIONS
  // ======================================================

  function openTask(task) {
    if (task?.project_id && getId(task)) {
      navigate(`/projects/${task.project_id}/tasks/${getId(task)}`);
    } else {
      navigate("/tasks");
    }
  }

  function createTask() {
    if (projects.length > 0 && getId(projects[0])) {
      navigate(`/projects/${getId(projects[0])}/tasks/create`);
    } else {
      navigate("/tasks");
    }
  }

  // ======================================================
  // CALCULATED DATA
  // ======================================================

  const completedTasks = useMemo(() => myTasks.filter(isCompleted), [myTasks]);

  const pendingTasks = useMemo(
    () => myTasks.filter((task) => !isCompleted(task)),
    [myTasks],
  );

  const activeProjects = useMemo(
    () => projects.filter((project) => !isProjectCompleted(project)),
    [projects],
  );

  const upcomingTasks = useMemo(
    () =>
      myTasks
        .filter((task) => getDueDate(task) && !isCompleted(task))
        .sort((first, second) => {
          const dueDifference =
            getDueDate(first).getTime() - getDueDate(second).getTime();

          if (dueDifference !== 0) return dueDifference;

          return (
            (PRIORITY_ORDER[getPriority(first)] ?? 2) -
            (PRIORITY_ORDER[getPriority(second)] ?? 2)
          );
        })
        .slice(0, 5),
    [myTasks],
  );

  const projectCards = useMemo(
    () =>
      projects.slice(0, 5).map((project, index) => {
        const projectId = Number(getId(project));

        const projectTasks = tasks.filter(
          (task) => Number(task.project_id) === projectId,
        );

        const memberCount =
          project.member_count ??
          project.members_count ??
          project.team_member_count ??
          null;

        const projectDueTask = myTasks
          .filter(
            (task) =>
              Number(task.project_id) === projectId &&
              getDueDate(task) &&
              !isCompleted(task),
          )
          .sort(
            (first, second) =>
              getDueDate(first).getTime() - getDueDate(second).getTime(),
          )[0];

        return {
          ...project,
          displayId: getId(project),
          taskCount: projectTasks.length,
          progress: getProjectProgress(project, tasks),
          memberCount,
          dueText: projectDueTask
            ? formatDueDate(projectDueTask)
            : "No upcoming deadline",
          displayStatus: getProjectStatus(project),
          displayIndex: index,
        };
      }),
    [projects, tasks, myTasks],
  );

  const projectStatusSummary = useMemo(() => {
    const total = projects.length;

    const completed = projects.filter(isProjectCompleted).length;

    const active = projects.filter((project) =>
      STATUS_ACTIVE.has(
        String(project.status || "")
          .trim()
          .toLowerCase(),
      ),
    ).length;

    const planned = Math.max(0, total - completed - active);

    return {
      total,
      completed,
      active,
      planned,
      completedPercent: total ? Math.round((completed / total) * 100) : 0,
      activePercent: total ? Math.round((active / total) * 100) : 0,
      plannedPercent: total ? Math.round((planned / total) * 100) : 0,
    };
  }, [projects]);

  const progress = myTasks.length
    ? Math.round((completedTasks.length / myTasks.length) * 100)
    : 0;

  // ======================================================
  // PAGE INFORMATION
  // ======================================================

  const currentWorkspaceName =
    workspaceName || activeWorkspace?.name || "Individual Workspace";

  const firstName = String(user?.name || "there")
    .trim()
    .split(/\s+/)[0];

  const todayGreeting = (() => {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";

    return "Good evening";
  })();

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="zyra-user-dashboard">
      {/* ==================================================
          PAGE HEADING
      ================================================== */}

      <section className="ud-page-heading">
        <div className="ud-heading-copy">
          <div className="ud-eyebrow">
            <span className="ud-eyebrow-dot" />
            YOUR WORKSPACE
          </div>

          <h1>
            {todayGreeting}, {firstName}
            <span className="ud-heading-wave" aria-hidden="true">
              {" "}
              ✨
            </span>
          </h1>

          <p>Here’s what’s happening with your work today.</p>

          <span className="ud-workspace-label">
            <span className="ud-workspace-dot" />
            {currentWorkspaceName}
          </span>
        </div>
      </section>

      {error && (
        <div className="ud-alert ud-alert-error" role="status">
          <span>{error}</span>

          <button type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {!workspaceId && !loading && (
        <div className="ud-workspace-empty-notice">
          <Sparkles size={18} />

          <p>
            You aren't connected to a workspace yet. Workspace invitations are
            available from the shared sidebar.
          </p>
        </div>
      )}

      {/* ==================================================
          SUMMARY CARDS
      ================================================== */}

      <section className="ud-stats-grid" aria-label="Workspace summary">
        <article className="ud-stat-card ud-stat-projects">
          <div className="ud-stat-top">
            <span className="ud-stat-icon">
              <FolderKanban size={20} />
            </span>

            <span className="ud-stat-label">My Projects</span>

            <span className="ud-stat-decoration">
              <ArrowUpRight size={16} />
            </span>
          </div>

          <div className="ud-stat-value">{loading ? "—" : projects.length}</div>

          <div className="ud-stat-footer">
            <span className="ud-stat-highlight">
              {loading ? "Loading" : `${activeProjects.length} active`}
            </span>

            <span className="ud-stat-separator">·</span>

            <span>
              {loading
                ? ""
                : `${projects.filter(isProjectCompleted).length} completed`}
            </span>
          </div>
        </article>

        <article className="ud-stat-card ud-stat-tasks">
          <div className="ud-stat-top">
            <span className="ud-stat-icon">
              <CheckSquare size={20} />
            </span>

            <span className="ud-stat-label">My Tasks</span>

            <span className="ud-stat-decoration">
              <ArrowUpRight size={16} />
            </span>
          </div>

          <div className="ud-stat-value">{loading ? "—" : myTasks.length}</div>

          <div className="ud-stat-footer">
            <span className="ud-stat-highlight">
              {loading ? "Loading" : `${pendingTasks.length} pending`}
            </span>

            <span className="ud-stat-separator">·</span>

            <span>{loading ? "" : `${completedTasks.length} completed`}</span>
          </div>
        </article>

        <article className="ud-stat-card ud-stat-teams">
          <div className="ud-stat-top">
            <span className="ud-stat-icon">
              <Users size={20} />
            </span>

            <span className="ud-stat-label">Teams</span>

            <span className="ud-stat-decoration">
              <ArrowUpRight size={16} />
            </span>
          </div>

          <div className="ud-stat-value">{loading ? "—" : teams.length}</div>

          <div className="ud-stat-footer">
            <span className="ud-stat-highlight">
              {loading ? "Loading" : "Available to you"}
            </span>
          </div>
        </article>
      </section>

      {/* ==================================================
          MAIN DASHBOARD GRID
      ================================================== */}

      <div className="ud-dashboard-grid">
        {/* LEFT COLUMN */}

        <div className="ud-main-column">
          {/* PROJECTS */}

          <section className="ud-panel ud-projects-panel">
            <div className="ud-panel-heading">
              <div>
                <span className="ud-section-kicker">YOUR WORK</span>

                <h2>My Projects</h2>

                <p>Projects assigned to you and their current progress.</p>
              </div>

              <button
                type="button"
                className="ud-text-link"
                onClick={() => navigate("/projects")}
              >
                View all
                <ArrowRight size={15} />
              </button>
            </div>

            {loading ? (
              <div className="ud-loading-state">
                <span className="ud-loading-dot" />
                Loading your assigned projects...
              </div>
            ) : projectCards.length === 0 ? (
              <div className="ud-empty-inline">
                <div className="ud-empty-inline-icon">
                  <FolderKanban size={21} />
                </div>

                <div>
                  <strong>No assigned projects yet</strong>

                  <p>
                    Projects assigned to you through accepted workspace
                    invitations will appear here.
                  </p>
                </div>

                <button
                  type="button"
                  className="ud-icon-button"
                  aria-label="Open projects"
                  onClick={() => navigate("/projects")}
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="ud-project-list">
                {projectCards.map((project) => (
                  <article className="ud-project-row" key={project.displayId}>
                    <button
                      type="button"
                      className={`ud-project-symbol ud-project-symbol-${
                        (project.displayIndex % 4) + 1
                      }`}
                      aria-label={`Open ${project.name || "project"}`}
                      onClick={() => navigate(`/projects/${project.displayId}`)}
                    >
                      {project.displayIndex % 4 === 0 ? (
                        <Workflow size={20} />
                      ) : project.displayIndex % 4 === 1 ? (
                        <Sparkles size={20} />
                      ) : project.displayIndex % 4 === 2 ? (
                        <Activity size={20} />
                      ) : (
                        <FolderKanban size={20} />
                      )}
                    </button>

                    <div className="ud-project-info">
                      <button
                        type="button"
                        className="ud-project-name"
                        onClick={() =>
                          navigate(`/projects/${project.displayId}`)
                        }
                      >
                        {project.name || "Untitled project"}
                      </button>

                      <p>
                        {project.description ||
                          "Make progress on your project tasks."}
                      </p>

                      <div className="ud-project-progress">
                        <div
                          className="ud-progress-track"
                          role="progressbar"
                          aria-label={`${project.name || "Project"} progress`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={project.progress}
                        >
                          <span
                            style={{
                              width: `${project.progress}%`,
                            }}
                          />
                        </div>

                        <span>{project.progress}%</span>
                      </div>

                      <div className="ud-project-meta">
                        <span>
                          <CheckSquare size={12} />
                          {project.taskCount}{" "}
                          {project.taskCount === 1 ? "task" : "tasks"}
                        </span>

                        {project.memberCount !== null && (
                          <span>
                            <Users size={12} />
                            {project.memberCount}{" "}
                            {Number(project.memberCount) === 1
                              ? "member"
                              : "members"}
                          </span>
                        )}

                        <span>
                          <Clock3 size={12} />
                          {project.dueText}
                        </span>
                      </div>
                    </div>

                    <div className="ud-project-side">
                      <span
                        className={`ud-project-status ud-status-${project.displayStatus
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {project.displayStatus}
                      </span>

                      <button
                        type="button"
                        className="ud-icon-button"
                        aria-label={`Open ${project.name || "project"}`}
                        onClick={() =>
                          navigate(`/projects/${project.displayId}`)
                        }
                      >
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* PROJECT PROGRESS AND QUICK ACTIONS */}

          <div className="ud-bottom-grid">
            <section className="ud-panel ud-overview-panel">
              <div className="ud-panel-heading ud-compact-heading">
                <div>
                  <span className="ud-section-kicker">OVERVIEW</span>

                  <h2>Project Progress</h2>
                </div>

                <span className="ud-overview-count">
                  {projectStatusSummary.total} total
                </span>
              </div>

              <div className="ud-overview-body">
                <div
                  className="ud-progress-donut"
                  style={{
                    "--ud-completed": `${projectStatusSummary.completedPercent}%`,
                    "--ud-active": `${projectStatusSummary.activePercent}%`,
                  }}
                  aria-label={`${projectStatusSummary.completedPercent}% of projects completed`}
                >
                  <div className="ud-progress-donut-inner">
                    <strong>
                      {projectStatusSummary.completed}/
                      {projectStatusSummary.total}
                    </strong>

                    <span>Completed</span>
                  </div>
                </div>

                <div className="ud-progress-legend">
                  <div>
                    <span className="ud-legend-dot ud-dot-completed" />
                    <span>Completed</span>

                    <strong>{projectStatusSummary.completedPercent}%</strong>
                  </div>

                  <div>
                    <span className="ud-legend-dot ud-dot-active" />
                    <span>In Progress</span>

                    <strong>{projectStatusSummary.activePercent}%</strong>
                  </div>

                  <div>
                    <span className="ud-legend-dot ud-dot-planned" />
                    <span>Planned</span>

                    <strong>{projectStatusSummary.plannedPercent}%</strong>
                  </div>
                </div>
              </div>
            </section>

            {/* QUICK ACTIONS */}

            <section className="ud-panel ud-quick-actions-panel">
              <div className="ud-panel-heading ud-compact-heading">
                <div>
                  <span className="ud-section-kicker">SHORTCUTS</span>

                  <h2>Quick Actions</h2>
                </div>

                <Sparkles size={17} className="ud-heading-icon" />
              </div>

              <div className="ud-quick-actions">
                <button
                  type="button"
                  className="ud-quick-action ud-action-project"
                  onClick={() => navigate("/projects/create")}
                >
                  <span>
                    <Plus size={16} />
                  </span>

                  <strong>Create Project</strong>

                  <ArrowRight size={15} />
                </button>

                <button
                  type="button"
                  className="ud-quick-action ud-action-task"
                  onClick={createTask}
                >
                  <span>
                    <CheckSquare size={16} />
                  </span>

                  <strong>Create Task</strong>

                  <ArrowRight size={15} />
                </button>

                <button
                  type="button"
                  className="ud-quick-action ud-action-team"
                  onClick={() => navigate("/teams")}
                >
                  <span>
                    <Users size={16} />
                  </span>

                  <strong>Explore Teams</strong>

                  <ArrowRight size={15} />
                </button>

                <button
                  type="button"
                  className="ud-quick-action ud-action-ai"
                  onClick={() => navigate("/ai-assistant")}
                >
                  <span>
                    <Sparkles size={16} />
                  </span>

                  <strong>Open AI Assistant</strong>

                  <ArrowRight size={15} />
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* RIGHT COLUMN */}

        <aside className="ud-right-column">
          {/* UPCOMING TASKS */}

          <section className="ud-panel ud-upcoming-panel">
            <div className="ud-panel-heading">
              <div>
                <span className="ud-section-kicker">STAY ON TRACK</span>

                <h2>Upcoming Tasks</h2>
              </div>

              <button
                type="button"
                className="ud-text-link"
                onClick={() => navigate("/tasks")}
              >
                View all
                <ArrowRight size={15} />
              </button>
            </div>

            {loading ? (
              <div className="ud-loading-state">
                <span className="ud-loading-dot" />
                Checking deadlines...
              </div>
            ) : upcomingTasks.length === 0 ? (
              <div className="ud-mini-empty">
                <CalendarClock size={22} />

                <p>No upcoming task deadlines.</p>
              </div>
            ) : (
              <div className="ud-upcoming-list">
                {upcomingTasks.map((task) => (
                  <button
                    type="button"
                    className="ud-upcoming-item"
                    key={getId(task)}
                    onClick={() => openTask(task)}
                  >
                    <span
                      className={`ud-task-check ${
                        isCompleted(task) ? "is-complete" : ""
                      }`}
                    >
                      {isCompleted(task) && <Check size={13} />}
                    </span>

                    <span className="ud-upcoming-copy">
                      <strong>{task.title || "Untitled task"}</strong>

                      <small>
                        {projects.find(
                          (project) =>
                            Number(getId(project)) === Number(task.project_id),
                        )?.name || "Assigned task"}
                      </small>

                      <span
                        className={`ud-task-due ${
                          isOverdue(task) ? "is-overdue" : ""
                        }`}
                      >
                        <Clock3 size={11} />

                        {isOverdue(task)
                          ? "Overdue"
                          : formatDueDate(task, true)}
                      </span>
                    </span>

                    <span
                      className={`ud-priority-badge ud-priority-${getPriority(
                        task,
                      )}`}
                    >
                      {getPriorityLabel(task)}
                    </span>

                    <ArrowRight size={14} className="ud-task-chevron" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* AI ASSISTANT */}

          <section className="ud-ai-card">
            <div className="ud-ai-card-glow" />

            <div className="ud-ai-card-content">
              <span className="ud-ai-chip">
                <Sparkles size={13} />
                ZYRA AI
              </span>

              <h3>Your next big idea starts here.</h3>

              <p>
                Get help planning tasks, organizing projects, and moving your
                work forward.
              </p>

              <button
                type="button"
                className="ud-ai-button"
                onClick={() => navigate("/ai-assistant")}
              >
                Start a conversation
                <ArrowRight size={15} />
              </button>
            </div>

            <div className="ud-ai-orbit ud-ai-orbit-one" />

            <div className="ud-ai-orbit ud-ai-orbit-two" />

            <div className="ud-ai-symbol">
              <Sparkles size={27} />
            </div>
          </section>

          {/* DAILY PROGRESS */}

          <section className="ud-panel ud-daily-panel">
            <div className="ud-panel-heading">
              <div>
                <span className="ud-section-kicker">YOUR MOMENTUM</span>

                <h2>Daily Progress</h2>
              </div>

              <Activity size={17} className="ud-heading-icon" />
            </div>

            <div className="ud-daily-progress">
              <div className="ud-daily-progress-top">
                <span>Assigned tasks completed</span>

                <strong>{progress}%</strong>
              </div>

              <div className="ud-progress-track ud-daily-track">
                <span
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <div className="ud-daily-progress-footer">
                <span>{completedTasks.length} completed</span>

                <span>{pendingTasks.length} remaining</span>
              </div>
            </div>

            <button
              type="button"
              className="ud-panel-footer-link"
              onClick={() => navigate("/tasks")}
            >
              Review your tasks
              <ArrowRight size={14} />
            </button>
          </section>
        </aside>
      </div>

      {/* ==================================================
          FOOTER
      ================================================== */}

      <footer className="ud-page-footer">
        <span>
          <span className="ud-footer-brand-dot" />
          ZYRA <span className="ud-footer-separator">/</span> PERSONAL WORKSPACE
        </span>

        <span>Built for focused work.</span>
      </footer>
    </div>
  );
}

export default UserDash;
