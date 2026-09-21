import {
  CheckSquare,
  Plus,
  ArrowLeft,
  Clock3,
  CircleCheck,
  AlertCircle,
  UserRound,
  Trash2,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getProjectById } from "../services/ProjectService";
import {
  getProjectTasks,
  updateTask,
  deleteTask,
} from "../services/taskService";
import { getTeamMembers } from "../services/teamService";
import { getCurrentUser } from "../services/authService";

function ProjectTasks() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [pendingAssignees, setPendingAssignees] = useState({});
  const [error, setError] = useState("");

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

  const inProgressTasks = tasks.filter(
    (task) => task.status === "in_progress" || task.status === "In Progress",
  );

  const completedTasks = tasks.filter(
    (task) =>
      task.status === "completed" ||
      task.status === "complete" ||
      task.status === "done" ||
      task.status === "Completed",
  );

  const overdueTasks = tasks.filter((task) => {
    if (!task.deadline) {
      return false;
    }

    const deadline = new Date(task.deadline);
    const today = new Date();

    deadline.setHours(23, 59, 59, 999);

    const isCompleted =
      task.status === "completed" ||
      task.status === "complete" ||
      task.status === "done" ||
      task.status === "Completed";

    return deadline < today && !isCompleted;
  });

  function getDisplayStatus(status) {
    switch (status) {
      case "in_progress":
        return "In Progress";

      case "completed":
      case "complete":
      case "done":
        return "Completed";

      case "todo":
        return "To Do";

      default:
        return status || "To Do";
    }
  }

  function getMemberName(member) {
    return member.name || member.email || `User ${member.id}`;
  }

  function isTaskCreator(task) {
    if (!currentUser?.id || !task?.created_by) {
      return false;
    }

    return Number(task.created_by) === Number(currentUser.id);
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

  return (
    <div className="zyra-project-tasks">
      <button
        className="back-page-btn"
        onClick={() => navigate(`/projects/${projectId}`)}
      >
        <ArrowLeft size={16} />
        Back to Projects
      </button>

      <div className="project-tasks-header">
        <div>
          <p className="project-tasks-eyebrow">PROJECT WORKSPACE</p>

          <h2>Project Tasks</h2>

          <p className="project-tasks-subtitle">
            Create, assign, and track tasks for this project.
          </p>
        </div>

        <button
          className="project-tasks-create-btn"
          onClick={() => navigate(`/projects/${projectId}/tasks/create`)}
        >
          <Plus size={17} />
          Create New Task
        </button>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      <div className="project-tasks-summary">
        <div className="project-task-summary-card">
          <div className="project-task-summary-icon">
            <CheckSquare size={19} />
          </div>

          <div>
            <span>Total Tasks</span>
            <strong>{loading ? "..." : tasks.length}</strong>
          </div>
        </div>

        <div className="project-task-summary-card">
          <div className="project-task-summary-icon">
            <Clock3 size={19} />
          </div>

          <div>
            <span>In Progress</span>
            <strong>{loading ? "..." : inProgressTasks.length}</strong>
          </div>
        </div>

        <div className="project-task-summary-card">
          <div className="project-task-summary-icon">
            <CircleCheck size={19} />
          </div>

          <div>
            <span>Completed</span>
            <strong>{loading ? "..." : completedTasks.length}</strong>
          </div>
        </div>

        <div className="project-task-summary-card">
          <div className="project-task-summary-icon">
            <AlertCircle size={19} />
          </div>

          <div>
            <span>Overdue</span>
            <strong>{loading ? "..." : overdueTasks.length}</strong>
          </div>
        </div>
      </div>

      <section className="project-tasks-panel">
        <div className="project-tasks-panel-header">
          <div>
            <h3>Project Task List</h3>

            <p>Tasks created for this project will appear here.</p>
          </div>
        </div>

        {loading ? (
          <div className="project-tasks-empty">
            <div className="project-tasks-empty-icon">
              <CheckSquare size={28} />
            </div>

            <h3>Loading tasks...</h3>

            <p>Getting tasks from the ZYRA workspace.</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="project-tasks-empty">
            <div className="project-tasks-empty-icon">
              <CheckSquare size={28} />
            </div>

            <h3>No tasks yet</h3>

            <p>
              Create your first task to start organizing and tracking the work
              for this project.
            </p>

            <button
              className="project-tasks-empty-btn"
              onClick={() => navigate(`/projects/${projectId}/tasks/create`)}
            >
              <Plus size={16} />
              Create Your First Task
            </button>
          </div>
        ) : (
          <div className="project-task-list">
            {tasks.map((task) => {
              const isCreator = isTaskCreator(task);
              const isDeleting = deletingTaskId === task.id;

              const selectedAssignee = getSelectedAssignee(task);
              const currentAssignee = getCurrentAssignee(task);

              const assigneeChanged = selectedAssignee !== currentAssignee;

              const isUpdating = updatingTaskId === task.id;

              return (
                <div
                  className="project-task-card"
                  key={task.id}
                  onClick={() => openTaskDetails(task.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="project-task-card-main">
                    <div className="project-task-card-icon">
                      <CheckSquare size={20} />
                    </div>

                    <div>
                      <h3>{task.title}</h3>

                      <p>{task.description || "No description provided."}</p>

                      <div className="project-task-card-meta">
                        <span>Priority: {task.priority || "Medium"}</span>

                        {task.deadline && (
                          <span>Deadline: {task.deadline}</span>
                        )}

                        <span>Status: {getDisplayStatus(task.status)}</span>
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "8px",
                      minWidth: "260px",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      <UserRound size={14} />
                      Assignee
                    </label>

                    {/* Assignee + Update button */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                      }}
                    >
                      <select
                        className="project-task-status"
                        style={{
                          width: "180px",
                          maxWidth: "180px",
                        }}
                        value={selectedAssignee}
                        onChange={(event) =>
                          handleAssigneeSelection(task.id, event.target.value)
                        }
                        disabled={isUpdating || isDeleting}
                      >
                        <option value="">Unassigned</option>

                        {teamMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {getMemberName(member)}
                          </option>
                        ))}
                      </select>

                      {assigneeChanged && (
                        <button
                          type="button"
                          className="project-tasks-create-btn"
                          style={{
                            width: "140px",
                            minWidth: "140px",
                            justifyContent: "center",
                            padding: "8px 10px",
                          }}
                          onClick={() => handleAssigneeUpdate(task)}
                          disabled={isUpdating || isDeleting}
                        >
                          {isUpdating ? "Updating..." : "Update Assignee"}
                        </button>
                      )}
                    </div>

                    {/* Status */}
                    <select
                      className="project-task-status"
                      style={{
                        width: "180px",
                        maxWidth: "180px",
                      }}
                      value={
                        task.status === "In Progress"
                          ? "in_progress"
                          : task.status
                      }
                      onChange={(event) => {
                        handleStatusChange(task.id, event.target.value);
                      }}
                      disabled={isUpdating || isDeleting}
                    >
                      <option value="todo">To Do</option>

                      <option value="in_progress">In Progress</option>

                      <option value="completed">Completed</option>
                    </select>

                    {/* Delete */}
                    {isCreator && (
                      <button
                        type="button"
                        className="project-task-delete-btn"
                        style={{
                          width: "180px",
                          maxWidth: "180px",
                          justifyContent: "center",
                        }}
                        onClick={() => handleDeleteTask(task)}
                        disabled={isDeleting}
                      >
                        <Trash2 size={14} />

                        {isDeleting ? "Deleting..." : "Delete Task"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default ProjectTasks;
