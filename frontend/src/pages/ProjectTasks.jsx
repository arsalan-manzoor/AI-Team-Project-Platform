import {
  CheckSquare,
  Plus,
  ArrowLeft,
  Clock3,
  CircleCheck,
  AlertCircle,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getProjectTasks, updateTask } from "../services/taskService";

function ProjectTasks() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProjectTasks() {
      try {
        setLoading(true);
        setError("");

        const tasksData = await getProjectTasks(projectId);

        setTasks(Array.isArray(tasksData) ? tasksData : []);
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

  async function handleStatusChange(taskId, newStatus) {
    try {
      setError("");
      setUpdatingTaskId(taskId);

      const currentTask = tasks.find((task) => task.id === taskId);

      const updatedTask = await updateTask(taskId, {
        title: currentTask.title,
        description: currentTask.description || "",
        status: newStatus,
        priority: currentTask.priority || "medium",
        deadline: currentTask.deadline || null,
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
            {tasks.map((task) => (
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

                      {task.deadline && <span>Deadline: {task.deadline}</span>}
                    </div>
                  </div>
                </div>

                <select
                  className="project-task-status"
                  value={
                    task.status === "In Progress" ? "in_progress" : task.status
                  }
                  onChange={(event) => {
                    event.stopPropagation();

                    handleStatusChange(task.id, event.target.value);
                  }}
                  onClick={(event) => event.stopPropagation()}
                  disabled={updatingTaskId === task.id}
                >
                  <option value="todo">To Do</option>

                  <option value="in_progress">In Progress</option>

                  <option value="completed">Completed</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default ProjectTasks;
