import { useEffect, useState } from "react";
import {
  CheckSquare,
  ArrowLeft,
  CalendarDays,
  Flag,
  CircleDot,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { createTask } from "../services/taskService";
import { getCurrentUser } from "../services/authService";

function CreateTask() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [user, setUser] = useState(null);

  const [task, setTask] = useState({
    name: "",
    description: "",
    priority: "medium",
    deadline: "",
    status: "todo",
  });

  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUser() {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error("Failed to load current user:", error);

        setError(error.message || "Failed to load your account information.");
      } finally {
        setLoadingUser(false);
      }
    }

    loadUser();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!projectId) {
      setError("Project ID is missing.");
      return;
    }

    if (!user?.id) {
      setError("Unable to identify the current user.");
      return;
    }

    try {
      setLoading(true);

      await createTask({
        title: task.name.trim(),
        description: task.description.trim(),
        projectId: Number(projectId),
        assignedTo: Number(user.id),
        status: task.status,
        priority: task.priority,
        deadline: task.deadline,
      });

      alert("Task created successfully!");

      navigate(`/projects/${projectId}/tasks`);
    } catch (error) {
      console.error("Task creation error:", error);

      setError(error.message || "Failed to create task.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="zyra-create-page">
      <button
        className="back-page-btn"
        onClick={() => navigate(`/projects/${projectId}/tasks`)}
        disabled={loading}
      >
        <ArrowLeft size={16} />
        Back to Project Tasks
      </button>

      <div className="create-page-header">
        <div className="create-page-icon">
          <CheckSquare size={22} />
        </div>

        <div>
          <p className="create-page-eyebrow">TASK WORKSPACE</p>

          <h2>Create New Task</h2>

          <p>
            Create a task and define its priority, deadline, and progress
            status.
          </p>
        </div>
      </div>

      <form className="zyra-create-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="form-section-header">
            <h3>Task Information</h3>

            <p>Describe what needs to be completed.</p>
          </div>

          <div className="form-group">
            <label>Task Name</label>

            <input
              type="text"
              placeholder="Enter task name"
              value={task.name}
              onChange={(event) =>
                setTask({
                  ...task,
                  name: event.target.value,
                })
              }
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Task Description</label>

            <textarea
              placeholder="Describe the task"
              rows="5"
              value={task.description}
              onChange={(event) =>
                setTask({
                  ...task,
                  description: event.target.value,
                })
              }
              required
              disabled={loading}
            ></textarea>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-header">
            <h3>Task Details</h3>

            <p>Set the priority, deadline, and current status.</p>
          </div>

          <div className="form-date-grid">
            <div className="form-group">
              <label>
                <Flag size={14} />
                Priority
              </label>

              <select
                value={task.priority}
                onChange={(event) =>
                  setTask({
                    ...task,
                    priority: event.target.value,
                  })
                }
                disabled={loading}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                <CircleDot size={14} />
                Status
              </label>

              <select
                value={task.status}
                onChange={(event) =>
                  setTask({
                    ...task,
                    status: event.target.value,
                  })
                }
                disabled={loading}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>
              <CalendarDays size={14} />
              Deadline
            </label>

            <input
              type="date"
              value={task.deadline}
              onChange={(event) =>
                setTask({
                  ...task,
                  deadline: event.target.value,
                })
              }
              required
              disabled={loading}
            />
          </div>

          {error && <p className="login-error">{error}</p>}
        </div>

        <div className="create-form-actions">
          <button
            type="button"
            className="cancel-form-btn"
            onClick={() => navigate(`/projects/${projectId}/tasks`)}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="submit-project-btn"
            disabled={loading || loadingUser}
          >
            <CheckSquare size={16} />

            {loading ? "Creating Task..." : "Create Task"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateTask;
