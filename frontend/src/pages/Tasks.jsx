import {
  CheckSquare,
  Clock3,
  CircleCheck,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getTasks } from "../services/taskService";
import { getCurrentUser } from "../services/authService";

function Tasks() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTasks() {
      try {
        setLoading(true);
        setError("");

        const [tasksData, userData] = await Promise.all([
          getTasks(),
          getCurrentUser(),
        ]);

        console.log("MY TASKS - tasks:", JSON.stringify(tasksData, null, 2));

        console.log(
          "MY TASKS - current user:",
          JSON.stringify(userData, null, 2),
        );

        const loadedTasks = Array.isArray(tasksData) ? tasksData : [];

        const userTasks = loadedTasks.filter((task) => {
          if (task.assigned_to === null || task.assigned_to === undefined) {
            return false;
          }

          return Number(task.assigned_to) === Number(userData.id);
        });

        setTasks(userTasks);
      } catch (error) {
        console.error("Tasks loading error:", error);

        setError(error.message || "Failed to load your tasks.");
      } finally {
        setLoading(false);
      }
    }

    loadTasks();
  }, []);

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

    return (
      deadline < today &&
      !(
        task.status === "completed" ||
        task.status === "complete" ||
        task.status === "done" ||
        task.status === "Completed"
      )
    );
  });

  function getDisplayStatus(status) {
    switch (status) {
      case "in_progress":
        return "In Progress";

      case "completed":
      case "complete":
      case "done":
        return "Completed";

      case "pending":
      case "todo":
        return "Pending";

      default:
        return status || "Pending";
    }
  }

  function openTaskDetails(task) {
    if (!task?.project_id || !task?.id) {
      setError("This task is missing its project information.");
      return;
    }

    navigate(`/projects/${task.project_id}/tasks/${task.id}`);
  }

  return (
    <div className="zyra-tasks">
      <div className="tasks-header">
        <div>
          <p className="tasks-eyebrow">TASK WORKSPACE</p>

          <h2>My Tasks</h2>

          <p className="tasks-subtitle">
            View and manage the tasks assigned to you across your projects.
          </p>
        </div>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      <div className="tasks-summary">
        <div className="task-summary-card">
          <div className="task-summary-icon">
            <CheckSquare size={19} />
          </div>

          <div>
            <span>Total Tasks</span>

            <strong>{loading ? "..." : tasks.length}</strong>
          </div>
        </div>

        <div className="task-summary-card">
          <div className="task-summary-icon">
            <Clock3 size={19} />
          </div>

          <div>
            <span>In Progress</span>

            <strong>{loading ? "..." : inProgressTasks.length}</strong>
          </div>
        </div>

        <div className="task-summary-card">
          <div className="task-summary-icon">
            <CircleCheck size={19} />
          </div>

          <div>
            <span>Completed</span>

            <strong>{loading ? "..." : completedTasks.length}</strong>
          </div>
        </div>

        <div className="task-summary-card">
          <div className="task-summary-icon">
            <AlertCircle size={19} />
          </div>

          <div>
            <span>Overdue</span>

            <strong>{loading ? "..." : overdueTasks.length}</strong>
          </div>
        </div>
      </div>

      <section className="tasks-panel">
        <div className="tasks-panel-header">
          <div>
            <h3>Assigned Tasks</h3>

            <p>Tasks assigned to you across your projects</p>
          </div>
        </div>

        {loading ? (
          <div className="tasks-empty">
            <div className="tasks-empty-icon">
              <CheckSquare size={28} />
            </div>

            <h3>Loading tasks...</h3>

            <p>Getting your assigned tasks from the ZYRA workspace.</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="tasks-empty">
            <div className="tasks-empty-icon">
              <CheckSquare size={28} />
            </div>

            <h3>No tasks assigned</h3>

            <p>
              Your assigned tasks will appear here when you start working on a
              project with your team.
            </p>
          </div>
        ) : (
          <div className="task-list">
            {tasks.map((task) => (
              <div
                className="task-card"
                key={task.id}
                onClick={() => openTaskDetails(task)}
                style={{
                  cursor: "pointer",
                }}
              >
                <div>
                  <h3>{task.title}</h3>

                  <p>{task.description || "No description provided."}</p>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span>{getDisplayStatus(task.status)}</span>

                  <ArrowRight size={17} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Tasks;
