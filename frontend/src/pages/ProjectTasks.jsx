import {
  Plus,
  ArrowLeft,
  Search,
  SlidersHorizontal,
  ChevronDown,
  CalendarDays,
  UserRound,
  Trash2,
  CircleDot,
  CheckCircle2,
  Clock3,
  Eye,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getProjectById } from "../services/ProjectService";
import {
  getProjectTasks,
  updateTask,
  deleteTask,
} from "../services/taskService";
import { getTeamMembers } from "../services/teamService";
import { getCurrentUser } from "../services/authService";
import { useWorkspace } from "../context/WorkspaceContext";

import "../styles/project-tasks.css";

function ProjectTasks() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const {
    activeWorkspace,
    workspaceId,
    workspaceRole,
    loading: workspaceLoading,
  } = useWorkspace();

  const normalizedWorkspaceRole = String(
    workspaceRole || activeWorkspace?.role || "",
  )
    .trim()
    .toUpperCase();

  const normalizedWorkspaceType = String(
    activeWorkspace?.type ||
      activeWorkspace?.workspace_type ||
      activeWorkspace?.workspaceType ||
      "INDIVIDUAL",
  )
    .trim()
    .toUpperCase();

  const isTeamLeader = normalizedWorkspaceRole === "TEAM_LEADER";
  const isRegularUser = normalizedWorkspaceRole === "USER";

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");

  // ======================================================
  // LOAD PROJECT, TASKS, USER AND TEAM MEMBERS
  // WITH ACTIVE WORKSPACE VALIDATION
  // ======================================================

  useEffect(() => {
    let cancelled = false;

    setProject(null);
    setTasks([]);
    setTeamMembers([]);
    setCurrentUser(null);
    setError("");
    setLoading(true);

    if (workspaceLoading) {
      return () => {
        cancelled = true;
      };
    }

    async function loadProjectTasks() {
      try {
        setLoading(true);
        setError("");

        if (!workspaceId) {
          throw new Error(
            "No active workspace was found. Please select a workspace and try again.",
          );
        }

        if (!projectId) {
          throw new Error("The project ID is missing.");
        }

        // STEP 1: Load and validate project ownership.

        const projectData = await getProjectById(projectId);

        if (cancelled) return;

        const loadedProject =
          projectData?.project ||
          projectData?.data?.project ||
          projectData?.data ||
          projectData;

        if (
          !loadedProject ||
          typeof loadedProject !== "object" ||
          Array.isArray(loadedProject)
        ) {
          throw new Error("The requested project could not be found.");
        }

        const projectWorkspaceId =
          loadedProject.workspace_id ??
          loadedProject.workspaceId ??
          loadedProject.workspace?.id ??
          loadedProject.workspace?.workspace_id ??
          loadedProject.team_workspace_id ??
          loadedProject.teamWorkspaceId ??
          loadedProject.team?.workspace_id ??
          loadedProject.team?.workspaceId ??
          loadedProject.team?.workspace?.id;

        if (
          projectWorkspaceId === null ||
          projectWorkspaceId === undefined ||
          projectWorkspaceId === ""
        ) {
          throw new Error(
            "This project does not include workspace ownership information. Refresh My Projects and open the project from the correct workspace.",
          );
        }

        if (Number(projectWorkspaceId) !== Number(workspaceId)) {
          throw new Error(
            "This project does not belong to the active workspace. Open it from the correct workspace.",
          );
        }

        const projectWorkspaceType = String(
          loadedProject.workspace_type ||
            loadedProject.workspaceType ||
            loadedProject.workspace?.type ||
            loadedProject.workspace?.workspace_type ||
            loadedProject.team_workspace_type ||
            "",
        )
          .trim()
          .toUpperCase();

        if (
          projectWorkspaceType &&
          normalizedWorkspaceType &&
          projectWorkspaceType !== normalizedWorkspaceType
        ) {
          throw new Error(
            "The project's workspace type does not match the active workspace.",
          );
        }

        if (cancelled) return;

        // STEP 2: Load tasks and signed-in user.

        const [tasksData, userData] = await Promise.all([
          getProjectTasks(projectId),
          getCurrentUser(),
        ]);

        if (cancelled) return;

        const loadedTasks = Array.isArray(tasksData)
          ? tasksData
          : Array.isArray(tasksData?.tasks)
            ? tasksData.tasks
            : Array.isArray(tasksData?.data?.tasks)
              ? tasksData.data.tasks
              : [];

        const signedInUser =
          userData?.user || userData?.data?.user || userData?.data || userData;

        if (signedInUser?.id === null || signedInUser?.id === undefined) {
          throw new Error("Unable to identify the signed-in user.");
        }

        // STEP 3: Keep tasks belonging to this project only.

        const currentProjectId = Number(projectId);

        const projectTasks = loadedTasks.filter((task) => {
          const taskProjectId =
            task?.project_id ??
            task?.projectId ??
            task?.project?.id ??
            task?.project?.project_id;

          if (
            taskProjectId === null ||
            taskProjectId === undefined ||
            taskProjectId === ""
          ) {
            return false;
          }

          return Number(taskProjectId) === currentProjectId;
        });

        // STEP 4: Apply workspace-role visibility.

        const visibleTasks = isRegularUser
          ? projectTasks.filter((task) => {
              const assignedTo = task.assigned_to ?? task.assignedTo;

              return (
                assignedTo !== null &&
                assignedTo !== undefined &&
                Number(assignedTo) === Number(signedInUser.id)
              );
            })
          : projectTasks;

        if (cancelled) return;

        setProject(loadedProject);
        setCurrentUser(signedInUser);
        setTasks(visibleTasks);

        // STEP 5: Load members of the validated project's team.

        const projectTeamId = loadedProject.team_id ?? loadedProject.teamId;

        if (
          projectTeamId !== null &&
          projectTeamId !== undefined &&
          projectTeamId !== ""
        ) {
          try {
            const membersData = await getTeamMembers(projectTeamId);

            if (!cancelled) {
              const loadedMembers = Array.isArray(membersData)
                ? membersData
                : Array.isArray(membersData?.members)
                  ? membersData.members
                  : Array.isArray(membersData?.data?.members)
                    ? membersData.data.members
                    : [];

              setTeamMembers(loadedMembers);
            }
          } catch (memberError) {
            console.error("Project team members loading error:", memberError);

            if (!cancelled) {
              setTeamMembers([]);
            }
          }
        } else {
          setTeamMembers([]);
        }
      } catch (requestError) {
        console.error("Project tasks loading error:", requestError);

        if (!cancelled) {
          setProject(null);
          setTasks([]);
          setTeamMembers([]);
          setCurrentUser(null);

          setError(requestError.message || "Failed to load project tasks.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProjectTasks();

    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    workspaceId,
    workspaceLoading,
    normalizedWorkspaceRole,
    normalizedWorkspaceType,
    isRegularUser,
  ]);

  // ======================================================
  // TASK STATUS HELPERS
  // ======================================================

  function normalizeStatus(status) {
    return String(status || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  }

  function isCompletedStatus(status) {
    const normalized = normalizeStatus(status);

    return ["completed", "complete", "done"].includes(normalized);
  }

  function isInProgressStatus(status) {
    return ["in_progress", "active", "doing"].includes(normalizeStatus(status));
  }

  function isReviewStatus(status) {
    return ["in_review", "review", "under_review"].includes(
      normalizeStatus(status),
    );
  }

  function isTodoStatus(status) {
    return ["", "todo", "to_do", "pending"].includes(normalizeStatus(status));
  }

  function getDisplayStatus(status) {
    if (isCompletedStatus(status)) return "Completed";
    if (isInProgressStatus(status)) return "In Progress";
    if (isReviewStatus(status)) return "In Review";

    return "To Do";
  }

  function getNextTaskStatus(status) {
    if (isTodoStatus(status)) return "in_progress";
    if (isInProgressStatus(status)) return "in_review";
    if (isReviewStatus(status)) return "completed";

    return null;
  }

  function getNextStatusLabel(status) {
    if (isTodoStatus(status)) return "Start Task";
    if (isInProgressStatus(status)) return "Send for Review";
    if (isReviewStatus(status)) return "Complete Task";

    return "Completed";
  }

  function getTaskProgress(task) {
    const numericProgress = Number(task?.progress);

    if (
      Number.isFinite(numericProgress) &&
      numericProgress >= 0 &&
      numericProgress <= 100
    ) {
      return numericProgress;
    }

    if (isCompletedStatus(task?.status)) return 100;
    if (isReviewStatus(task?.status)) return 80;
    if (isInProgressStatus(task?.status)) return 50;

    return 0;
  }

  // ======================================================
  // USER AND TASK HELPERS
  // ======================================================

  function getTaskId(task) {
    return task?.id ?? task?.task_id;
  }

  function getTaskAssigneeId(task) {
    return task?.assigned_to ?? task?.assignedTo ?? null;
  }

  function getMemberId(member) {
    return member?.id ?? member?.user_id;
  }

  function getMemberName(member) {
    return (
      member?.name ||
      member?.user_name ||
      member?.username ||
      member?.email ||
      `User ${getMemberId(member)}`
    );
  }

  function getMemberEmail(member) {
    return member?.email || member?.user_email || member?.user?.email || "";
  }

  function getMemberInitials(member) {
    const name = getMemberName(member);
    const parts = name.trim().split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
  }

  function getTaskAssignee(task) {
    const assignedTo = getTaskAssigneeId(task);

    if (assignedTo === null || assignedTo === undefined || assignedTo === "") {
      return null;
    }

    return (
      teamMembers.find(
        (member) => Number(getMemberId(member)) === Number(assignedTo),
      ) || null
    );
  }

  function isTaskAssignedToCurrentUser(task) {
    if (currentUser?.id === null || currentUser?.id === undefined) {
      return false;
    }

    const assignedTo = getTaskAssigneeId(task);

    return (
      assignedTo !== null &&
      assignedTo !== undefined &&
      Number(assignedTo) === Number(currentUser.id)
    );
  }

  function canUpdateTask(task) {
    return isTaskAssignedToCurrentUser(task);
  }

  function canCreateTask() {
    return isTeamLeader;
  }

  function canDeleteTask() {
    return isTeamLeader;
  }

  // ======================================================
  // TASK STATUS UPDATE
  // ======================================================

  async function handleStatusChange(task) {
    const taskId = getTaskId(task);

    if (!canUpdateTask(task)) {
      setError("You can update only tasks assigned to your account.");
      return;
    }

    if (updatingTaskId !== null || deletingTaskId !== null) {
      return;
    }

    const nextStatus = getNextTaskStatus(task.status);

    if (!nextStatus) return;

    try {
      setError("");
      setUpdatingTaskId(taskId);

      const updatedTask = await updateTask(taskId, {
        status: nextStatus,
      });

      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          Number(getTaskId(currentTask)) === Number(taskId)
            ? {
                ...currentTask,
                ...(updatedTask || {}),
                status: updatedTask?.status || nextStatus,
                progress:
                  updatedTask?.progress ??
                  getTaskProgress({
                    ...currentTask,
                    status: nextStatus,
                  }),
              }
            : currentTask,
        ),
      );
    } catch (requestError) {
      console.error("Task status update error:", requestError);

      setError(requestError.message || "Failed to update task status.");
    } finally {
      setUpdatingTaskId(null);
    }
  }

  // ======================================================
  // DELETE TASK
  // ======================================================

  async function handleDeleteTask(task) {
    if (!canDeleteTask(task)) {
      setError("Only a Team Leader can delete tasks.");
      return;
    }

    const taskId = getTaskId(task);

    const confirmed = window.confirm(
      `Are you sure you want to delete "${task.title || "this task"}"?`,
    );

    if (!confirmed) return;

    try {
      setError("");
      setDeletingTaskId(taskId);

      await deleteTask(taskId);

      setTasks((currentTasks) =>
        currentTasks.filter(
          (currentTask) => Number(getTaskId(currentTask)) !== Number(taskId),
        ),
      );
    } catch (requestError) {
      console.error("Task deletion error:", requestError);

      setError(requestError.message || "Failed to delete task.");
    } finally {
      setDeletingTaskId(null);
    }
  }

  // ======================================================
  // NAVIGATION
  // ======================================================

  function openTaskDetails(taskId) {
    navigate(
      `/projects/${encodeURIComponent(
        projectId,
      )}/tasks/${encodeURIComponent(taskId)}`,
    );
  }

  // ======================================================
  // DATE FILTER
  // ======================================================

  function matchesDueDate(task) {
    if (dueDateFilter === "all") return true;

    if (!task.deadline) {
      return dueDateFilter === "none";
    }

    const deadline = new Date(task.deadline);
    const today = new Date();

    if (Number.isNaN(deadline.getTime())) {
      return dueDateFilter === "none";
    }

    deadline.setHours(23, 59, 59, 999);
    today.setHours(0, 0, 0, 0);

    if (dueDateFilter === "overdue") {
      return deadline < today && !isCompletedStatus(task.status);
    }

    if (dueDateFilter === "today") {
      return (
        deadline.getFullYear() === today.getFullYear() &&
        deadline.getMonth() === today.getMonth() &&
        deadline.getDate() === today.getDate()
      );
    }

    if (dueDateFilter === "upcoming") {
      return deadline >= today;
    }

    if (dueDateFilter === "none") {
      return false;
    }

    return true;
  }

  // ======================================================
  // TASK FILTERING
  // ======================================================

  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !query ||
        String(task.title || "")
          .toLowerCase()
          .includes(query) ||
        String(task.description || "")
          .toLowerCase()
          .includes(query) ||
        String(getTaskId(task)).includes(query);

      const matchesPriority =
        priorityFilter === "all" ||
        String(task.priority || "medium").toLowerCase() === priorityFilter;

      const matchesAssignee =
        assigneeFilter === "all" ||
        String(getTaskAssigneeId(task) || "") === assigneeFilter;

      return (
        matchesSearch &&
        matchesPriority &&
        matchesAssignee &&
        matchesDueDate(task)
      );
    });
  }, [tasks, searchTerm, priorityFilter, assigneeFilter, dueDateFilter]);

  const groupedTasks = {
    todo: filteredTasks.filter((task) => isTodoStatus(task.status)),

    in_progress: filteredTasks.filter((task) =>
      isInProgressStatus(task.status),
    ),

    in_review: filteredTasks.filter((task) => isReviewStatus(task.status)),

    completed: filteredTasks.filter((task) => isCompletedStatus(task.status)),
  };

  // ======================================================
  // SUMMARY AND DISPLAY HELPERS
  // ======================================================

  const completedTasks = tasks.filter((task) => isCompletedStatus(task.status));

  const overdueTasks = tasks.filter((task) => {
    if (!task.deadline || isCompletedStatus(task.status)) {
      return false;
    }

    const deadline = new Date(task.deadline);

    if (Number.isNaN(deadline.getTime())) {
      return false;
    }

    const today = new Date();

    deadline.setHours(23, 59, 59, 999);

    return deadline < today;
  });

  const progressPercentage =
    tasks.length > 0
      ? Math.round(
          tasks.reduce((total, task) => total + getTaskProgress(task), 0) /
            tasks.length,
        )
      : 0;

  function getPriorityClass(priority) {
    const value = String(priority || "medium").toLowerCase();

    if (value === "critical") return "critical";
    if (value === "high") return "high";
    if (value === "low") return "low";

    return "medium";
  }

  function formatDeadline(deadline) {
    if (!deadline) return "No deadline";

    const date = new Date(deadline);

    if (Number.isNaN(date.getTime())) {
      return "No deadline";
    }

    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
  }

  // ======================================================
  // TASK CARD
  // ======================================================

  function renderTaskCard(task) {
    const taskId = getTaskId(task);
    const assignee = getTaskAssignee(task);

    const canEdit = canUpdateTask(task);
    const canDelete = canDeleteTask(task);

    const isUpdating = Number(updatingTaskId) === Number(taskId);
    const isDeleting = Number(deletingTaskId) === Number(taskId);

    const priority = String(task.priority || "medium").toLowerCase();

    const progress = getTaskProgress(task);
    const nextStatus = getNextTaskStatus(task.status);
    const nextStatusLabel = getNextStatusLabel(task.status);

    return (
      <article
        className="workflow-task-card"
        key={taskId}
        onClick={() => openTaskDetails(taskId)}
      >
        <div className="workflow-task-card-top">
          <h4>{task.title || "Untitled task"}</h4>

          <span className="task-reference">ZYRA-{taskId}</span>
        </div>

        <p className="workflow-task-description">
          {task.description || "No description provided."}
        </p>

        <div className="workflow-task-footer">
          <div className="workflow-assignee">
            {assignee ? (
              <span className="workflow-avatar">
                {getMemberInitials(assignee)}
              </span>
            ) : (
              <span className="workflow-avatar unassigned">
                <UserRound size={12} />
              </span>
            )}

            <span>{assignee ? getMemberName(assignee) : "Unassigned"}</span>
          </div>

          <div className="workflow-deadline">
            <span>Deadline</span>

            <strong>
              <CalendarDays size={12} />
              {formatDeadline(task.deadline)}
            </strong>
          </div>
        </div>

        <div className="workflow-task-meta">
          <span className={`workflow-priority ${getPriorityClass(priority)}`}>
            {priority}
          </span>

          <span
            className={`workflow-status-pill ${normalizeStatus(task.status)}`}
          >
            <CircleDot size={10} />

            {getDisplayStatus(task.status)}
          </span>
        </div>

        {/* TASK PROGRESS */}

        <div
          className="workflow-task-progress"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="workflow-task-progress-label">
            <span>Progress</span>
            <strong>{progress}%</strong>
          </div>

          <div className="workflow-task-progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* TASK CONTROLS */}

        <div
          className="workflow-task-controls"
          onClick={(event) => event.stopPropagation()}
        >
          {canEdit ? (
            nextStatus ? (
              <button
                type="button"
                className="workflow-task-next-btn"
                onClick={() => handleStatusChange(task)}
                disabled={isUpdating || isDeleting}
              >
                {isUpdating ? "Updating..." : nextStatusLabel}
              </button>
            ) : (
              <span
                className="workflow-task-readonly"
                title="This task is completed"
              >
                <CheckCircle2 size={13} />
                Task completed
              </span>
            )
          ) : (
            <span
              className="workflow-task-readonly"
              title="Only the assigned user can update this task"
            >
              <Eye size={13} />
              {isTeamLeader ? "Tracking only" : "View only"}
            </span>
          )}

          {canDelete && (
            <button
              type="button"
              className="workflow-delete-btn"
              onClick={() => handleDeleteTask(task)}
              disabled={isDeleting || isUpdating}
              aria-label="Delete task"
              title="Delete task"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </article>
    );
  }

  // ======================================================
  // WORKFLOW COLUMN
  // ======================================================

  function renderWorkflowColumn(key, title, count, icon, columnTasks) {
    return (
      <section className={`workflow-column workflow-column-${key}`}>
        <div className="workflow-column-header">
          <div className="workflow-column-title">
            {icon}
            <span>{title}</span>
            <strong>{count}</strong>
          </div>
        </div>

        <div className="workflow-column-line" />

        <div className="workflow-column-tasks">
          {columnTasks.length > 0 ? (
            columnTasks.map(renderTaskCard)
          ) : (
            <div className="workflow-column-empty">
              <span />
              <p>No tasks</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="zyra-project-tasks">
      <button
        type="button"
        className="workflow-back-btn"
        onClick={() => navigate(`/projects/${projectId}`)}
      >
        <ArrowLeft size={15} />
        Back to Project
      </button>

      <header className="workflow-page-header">
        {/* PROJECT TITLE */}

        <div className="workflow-title-block">
          <div className="workflow-brand-mark">Z</div>

          <div>
            <h1>ZYRA Project Tasks</h1>

            <div className="workflow-breadcrumb">
              <span>Home</span>
              <span>/</span>
              <span>Projects</span>
              <span>/</span>
              <span>{project?.name || "Project"}</span>
              <span>/</span>
              <strong>Tasks</strong>
            </div>
          </div>
        </div>

        {/* PROJECT PROGRESS */}

        <div className="workflow-progress">
          <div className="workflow-progress-label">
            <span>Project Progress</span>

            <strong>
              {loading ? "..." : `${progressPercentage}% Complete`}
            </strong>
          </div>

          <div
            className="workflow-progress-track"
            role="progressbar"
            aria-label="Overall project task progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercentage}
          >
            <span
              style={{
                width: `${progressPercentage}%`,
              }}
            />
          </div>
        </div>

        {/* PROJECT NAME, TEAM MEMBERS AND CREATE BUTTON */}

        <div className="workflow-header-actions">
          <div className="workflow-project-name">
            <span>Project Name</span>

            <strong title={project?.name || "Project"}>
              <span className="workflow-project-name-text">
                {project?.name || "Project"}
              </span>

              <ChevronDown size={14} />
            </strong>
          </div>

          {/* CLICK THE AVATARS TO VIEW ALL PROJECT TEAM MEMBERS */}

          {teamMembers.length > 0 && (
            <details className="workflow-team-members">
              <summary
                className="workflow-team-avatars"
                aria-label={`Show ${teamMembers.length} project team members`}
                title="Click to view project team members"
              >
                {teamMembers.slice(0, 4).map((member) => (
                  <span
                    className="workflow-header-avatar"
                    key={getMemberId(member)}
                    aria-hidden="true"
                  >
                    {getMemberInitials(member)}
                  </span>
                ))}

                {teamMembers.length > 4 && (
                  <span
                    className="workflow-header-avatar more"
                    aria-hidden="true"
                  >
                    +{teamMembers.length - 4}
                  </span>
                )}
              </summary>

              <div
                className="workflow-team-popover"
                role="region"
                aria-label="Project team members"
              >
                <div className="workflow-team-popover-header">
                  <div>
                    <span>PROJECT TEAM</span>
                    <strong>Team Members</strong>
                  </div>

                  <span className="workflow-team-count">
                    {teamMembers.length}
                  </span>
                </div>

                <div className="workflow-team-member-list">
                  {teamMembers.map((member, index) => {
                    const memberName = getMemberName(member);
                    const memberEmail = getMemberEmail(member);

                    return (
                      <div
                        className="workflow-team-member"
                        key={getMemberId(member) ?? index}
                      >
                        <span className="workflow-team-member-avatar">
                          {getMemberInitials(member)}
                        </span>

                        <span className="workflow-team-member-info">
                          <strong>{memberName}</strong>

                          {memberEmail && <small>{memberEmail}</small>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
          )}

          {canCreateTask() && (
            <button
              type="button"
              className="workflow-create-btn"
              onClick={() => navigate(`/projects/${projectId}/tasks/create`)}
            >
              <Plus size={16} />
              Create Task
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="workflow-error" role="alert">
          {error}
        </div>
      )}

      <main className="workflow-panel">
        <div className="workflow-panel-header">
          <div>
            <h2>Project Workflow Timeline</h2>

            <p>
              Track the movement of work through every stage of the project.
            </p>
          </div>

          <div className="workflow-filter-row">
            <div className="workflow-filter-label">
              <SlidersHorizontal size={14} />
              Filters
            </div>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
            >
              <option value="all">Priority</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
            >
              <option value="all">Assignee</option>

              {teamMembers.map((member) => (
                <option key={getMemberId(member)} value={getMemberId(member)}>
                  {getMemberName(member)}
                </option>
              ))}
            </select>

            <select
              value={dueDateFilter}
              onChange={(event) => setDueDateFilter(event.target.value)}
            >
              <option value="all">Due Date</option>
              <option value="today">Due Today</option>
              <option value="upcoming">Upcoming</option>
              <option value="overdue">Overdue</option>
              <option value="none">No Deadline</option>
            </select>

            <div className="workflow-search">
              <Search size={15} />

              <input
                type="search"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="workflow-loading">
            <div className="workflow-loading-spinner" />

            <h3>Loading project workflow...</h3>

            <p>Getting tasks from the ZYRA workspace.</p>
          </div>
        ) : error && tasks.length === 0 ? (
          <div className="workflow-empty">
            <h3>Unable to load project tasks</h3>

            <p>{error}</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="workflow-empty">
            <div className="workflow-empty-icon">
              <CheckCircle2 size={28} />
            </div>

            <h3>No tasks available</h3>

            <p>
              {isRegularUser
                ? "Tasks assigned to you will appear here."
                : "Create your first task to start building the project workflow."}
            </p>

            {canCreateTask() && (
              <button
                type="button"
                className="workflow-create-btn"
                onClick={() => navigate(`/projects/${projectId}/tasks/create`)}
              >
                <Plus size={16} />
                Create Task
              </button>
            )}
          </div>
        ) : (
          <div className="workflow-board">
            {renderWorkflowColumn(
              "todo",
              "To Do",
              groupedTasks.todo.length,
              <Clock3 size={14} />,
              groupedTasks.todo,
            )}

            {renderWorkflowColumn(
              "in-progress",
              "In Progress",
              groupedTasks.in_progress.length,
              <CircleDot size={14} />,
              groupedTasks.in_progress,
            )}

            {renderWorkflowColumn(
              "in-review",
              "In Review",
              groupedTasks.in_review.length,
              <Eye size={14} />,
              groupedTasks.in_review,
            )}

            {renderWorkflowColumn(
              "completed",
              "Completed",
              groupedTasks.completed.length,
              <CheckCircle2 size={14} />,
              groupedTasks.completed,
            )}
          </div>
        )}

        {!loading && tasks.length > 0 && filteredTasks.length === 0 && (
          <div className="workflow-filter-empty">
            No tasks match the selected filters.
          </div>
        )}

        <div className="workflow-board-footer">
          <span>
            {filteredTasks.length} of {tasks.length} tasks shown
          </span>

          <span>{overdueTasks.length} overdue</span>
        </div>
      </main>
    </div>
  );
}

export default ProjectTasks;
