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

import "../styles/project-tasks.css";

function ProjectTasks() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [pendingAssignees, setPendingAssignees] = useState({});
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");

  useEffect(() => {
    async function loadProjectTasks() {
      try {
        setLoading(true);
        setError("");

        const [projectData, tasksData, userData] = await Promise.all([
          getProjectById(projectId),
          getProjectTasks(projectId),
          getCurrentUser(),
        ]);

        setProject(projectData);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
        setCurrentUser(userData);

        if (projectData?.team_id) {
          const membersData = await getTeamMembers(projectData.team_id);

          setTeamMembers(Array.isArray(membersData) ? membersData : []);
        } else {
          setTeamMembers([]);
        }
      } catch (error) {
        console.error("Project tasks loading error:", error);

        setError(error.message || "Failed to load project tasks.");
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      loadProjectTasks();
    }
  }, [projectId]);

  const completedTasks = tasks.filter((task) => isCompletedStatus(task.status));

  const inProgressTasks = tasks.filter((task) =>
    isInProgressStatus(task.status),
  );

  const todoTasks = tasks.filter((task) => isTodoStatus(task.status));

  const reviewTasks = tasks.filter((task) => isReviewStatus(task.status));

  const overdueTasks = tasks.filter((task) => {
    if (!task.deadline || isCompletedStatus(task.status)) {
      return false;
    }

    const deadline = new Date(task.deadline);
    const today = new Date();

    deadline.setHours(23, 59, 59, 999);

    return deadline < today;
  });

  const progressPercentage =
    tasks.length > 0
      ? Math.round((completedTasks.length / tasks.length) * 100)
      : 0;

  function normalizeStatus(status) {
    return String(status || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function isCompletedStatus(status) {
    const normalized = normalizeStatus(status);

    return (
      normalized === "completed" ||
      normalized === "complete" ||
      normalized === "done"
    );
  }

  function isInProgressStatus(status) {
    return normalizeStatus(status) === "in_progress";
  }

  function isReviewStatus(status) {
    const normalized = normalizeStatus(status);

    return (
      normalized === "in_review" ||
      normalized === "review" ||
      normalized === "under_review"
    );
  }

  function isTodoStatus(status) {
    const normalized = normalizeStatus(status);

    return normalized === "" || normalized === "todo" || normalized === "to_do";
  }

  function getDisplayStatus(status) {
    if (isCompletedStatus(status)) {
      return "Completed";
    }

    if (isInProgressStatus(status)) {
      return "In Progress";
    }

    if (isReviewStatus(status)) {
      return "In Review";
    }

    return "To Do";
  }

  function getMemberName(member) {
    return (
      member.name ||
      member.user_name ||
      member.username ||
      member.email ||
      `User ${member.id}`
    );
  }

  function getMemberId(member) {
    return member.id || member.user_id;
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
    if (
      task.assigned_to === null ||
      task.assigned_to === undefined ||
      task.assigned_to === ""
    ) {
      return null;
    }

    return teamMembers.find(
      (member) => Number(getMemberId(member)) === Number(task.assigned_to),
    );
  }

  function getCurrentAssignee(task) {
    if (
      task.assigned_to === null ||
      task.assigned_to === undefined ||
      task.assigned_to === ""
    ) {
      return "";
    }

    return String(task.assigned_to);
  }

  function getSelectedAssignee(task) {
    if (Object.prototype.hasOwnProperty.call(pendingAssignees, task.id)) {
      return pendingAssignees[task.id];
    }

    return getCurrentAssignee(task);
  }

  function handleAssigneeSelection(taskId, newAssignee) {
    setError("");

    setPendingAssignees((current) => ({
      ...current,
      [taskId]: newAssignee,
    }));
  }

  function isTaskCreator(task) {
    if (!currentUser?.id || !task?.created_by) {
      return false;
    }

    return Number(task.created_by) === Number(currentUser.id);
  }

  async function handleAssigneeUpdate(task) {
    const selectedAssignee = getSelectedAssignee(task);
    const currentAssignee = getCurrentAssignee(task);

    if (selectedAssignee === currentAssignee) {
      return;
    }

    try {
      setError("");
      setUpdatingTaskId(task.id);

      const assignedTo = selectedAssignee ? Number(selectedAssignee) : null;

      const updatedTask = await updateTask(task.id, {
        title: task.title,
        description: task.description || "",
        status: task.status || "todo",
        priority: task.priority || "medium",
        deadline: task.deadline || null,
        assignedTo,
      });

      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          currentTask.id === task.id
            ? {
                ...currentTask,
                ...(updatedTask || {}),
                assigned_to: updatedTask?.assigned_to ?? assignedTo,
              }
            : currentTask,
        ),
      );

      setPendingAssignees((current) => {
        const updated = { ...current };
        delete updated[task.id];
        return updated;
      });
    } catch (error) {
      console.error("Task reassignment error:", error);

      setError(error.message || "Failed to reassign task.");
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleStatusChange(taskId, newStatus) {
    try {
      setError("");
      setUpdatingTaskId(taskId);

      const currentTask = tasks.find((task) => task.id === taskId);

      if (!currentTask) {
        setError("Task could not be found.");
        return;
      }

      const updatedTask = await updateTask(taskId, {
        title: currentTask.title,
        description: currentTask.description || "",
        status: newStatus,
        priority: currentTask.priority || "medium",
        deadline: currentTask.deadline || null,
        assignedTo:
          currentTask.assigned_to !== null &&
          currentTask.assigned_to !== undefined
            ? Number(currentTask.assigned_to)
            : null,
      });

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...(updatedTask || {}),
                status: updatedTask?.status || newStatus,
              }
            : task,
        ),
      );
    } catch (error) {
      console.error("Task status update error:", error);

      setError(error.message || "Failed to update task status.");
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleDeleteTask(task) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${task.title}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setDeletingTaskId(task.id);

      await deleteTask(task.id);

      setTasks((currentTasks) =>
        currentTasks.filter((currentTask) => currentTask.id !== task.id),
      );

      setPendingAssignees((current) => {
        const updated = { ...current };
        delete updated[task.id];
        return updated;
      });
    } catch (error) {
      console.error("Task deletion error:", error);

      setError(error.message || "Failed to delete task.");
    } finally {
      setDeletingTaskId(null);
    }
  }

  function openTaskDetails(taskId) {
    navigate(`/projects/${projectId}/tasks/${taskId}`);
  }

  function matchesDueDate(task) {
    if (dueDateFilter === "all") {
      return true;
    }

    if (!task.deadline) {
      return dueDateFilter === "none";
    }

    const deadline = new Date(task.deadline);
    const today = new Date();

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

  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !query ||
        task.title?.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        String(task.id).includes(query);

      const matchesPriority =
        priorityFilter === "all" ||
        String(task.priority || "medium").toLowerCase() === priorityFilter;

      const matchesAssignee =
        assigneeFilter === "all" ||
        String(task.assigned_to || "") === assigneeFilter;

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

  function getPriorityClass(priority) {
    const value = String(priority || "medium").toLowerCase();

    if (value === "critical") {
      return "critical";
    }

    if (value === "high") {
      return "high";
    }

    if (value === "low") {
      return "low";
    }

    return "medium";
  }

  function formatDeadline(deadline) {
    if (!deadline) {
      return "No deadline";
    }

    const date = new Date(deadline);

    if (Number.isNaN(date.getTime())) {
      return deadline;
    }

    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
  }

  function renderTaskCard(task) {
    const assignee = getTaskAssignee(task);
    const selectedAssignee = getSelectedAssignee(task);
    const currentAssignee = getCurrentAssignee(task);

    const assigneeChanged = selectedAssignee !== currentAssignee;

    const isUpdating = updatingTaskId === task.id;
    const isDeleting = deletingTaskId === task.id;
    const isCreator = isTaskCreator(task);

    const priority = String(task.priority || "medium").toLowerCase();

    return (
      <article
        className="workflow-task-card"
        key={task.id}
        onClick={() => openTaskDetails(task.id)}
      >
        <div className="workflow-task-card-top">
          <h4>{task.title}</h4>

          <span className="task-reference">ZYRA-{task.id}</span>
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

        <div
          className="workflow-task-controls"
          onClick={(event) => event.stopPropagation()}
        >
          <select
            value={selectedAssignee}
            onChange={(event) =>
              handleAssigneeSelection(task.id, event.target.value)
            }
            disabled={isUpdating || isDeleting}
            aria-label="Change assignee"
          >
            <option value="">Unassigned</option>

            {teamMembers.map((member) => (
              <option key={getMemberId(member)} value={getMemberId(member)}>
                {getMemberName(member)}
              </option>
            ))}
          </select>

          {assigneeChanged && (
            <button
              type="button"
              className="workflow-update-btn"
              onClick={() => handleAssigneeUpdate(task)}
              disabled={isUpdating || isDeleting}
            >
              {isUpdating ? "Updating..." : "Update"}
            </button>
          )}

          <select
            value={
              isReviewStatus(task.status)
                ? "in_review"
                : isInProgressStatus(task.status)
                  ? "in_progress"
                  : isCompletedStatus(task.status)
                    ? "completed"
                    : "todo"
            }
            onChange={(event) =>
              handleStatusChange(task.id, event.target.value)
            }
            disabled={isUpdating || isDeleting}
            aria-label="Change status"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="completed">Completed</option>
          </select>

          {isCreator && (
            <button
              type="button"
              className="workflow-delete-btn"
              onClick={() => handleDeleteTask(task)}
              disabled={isDeleting}
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

        <div className="workflow-progress">
          <div className="workflow-progress-label">
            <span>Progress:</span>
            <strong>
              {loading ? "..." : `${progressPercentage}% Complete`}
            </strong>
          </div>

          <div className="workflow-progress-track">
            <span
              style={{
                width: `${progressPercentage}%`,
              }}
            />
          </div>
        </div>

        <div className="workflow-header-actions">
          <div className="workflow-project-name">
            <span>Project Name</span>
            <strong>
              {project?.name || "Project"}
              <ChevronDown size={14} />
            </strong>
          </div>

          <div className="workflow-team-avatars">
            {teamMembers.slice(0, 4).map((member) => (
              <span
                className="workflow-header-avatar"
                key={getMemberId(member)}
                title={getMemberName(member)}
              >
                {getMemberInitials(member)}
              </span>
            ))}

            {teamMembers.length > 4 && (
              <span className="workflow-header-avatar more">
                +{teamMembers.length - 4}
              </span>
            )}
          </div>

          <button
            type="button"
            className="workflow-create-btn"
            onClick={() => navigate(`/projects/${projectId}/tasks/create`)}
          >
            <Plus size={16} />
            Create Task
          </button>
        </div>
      </header>

      {error && <div className="workflow-error">{error}</div>}

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
        ) : tasks.length === 0 ? (
          <div className="workflow-empty">
            <div className="workflow-empty-icon">
              <CheckCircle2 size={28} />
            </div>

            <h3>No tasks yet</h3>

            <p>
              Create your first task to start building the project workflow.
            </p>

            <button
              type="button"
              className="workflow-create-btn"
              onClick={() => navigate(`/projects/${projectId}/tasks/create`)}
            >
              <Plus size={16} />
              Create Task
            </button>
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
