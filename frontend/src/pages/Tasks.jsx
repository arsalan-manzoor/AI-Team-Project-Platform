import {
  CheckSquare,
  Clock3,
  CircleCheck,
  AlertCircle,
  ArrowRight,
  Activity,
  CalendarDays,
  ListFilter,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getTasks } from "../services/taskService";
import { getCurrentUser } from "../services/authService";

import "../styles/tasks.css";

function Tasks() {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

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

  const isCompleted = (task) => {
    return (
      task.status === "completed" ||
      task.status === "complete" ||
      task.status === "done" ||
      task.status === "Completed"
    );
  };

  const isInProgress = (task) => {
    return task.status === "in_progress" || task.status === "In Progress";
  };

  const isOverdue = (task) => {
    if (!task.deadline || isCompleted(task)) {
      return false;
    }

    const deadline = new Date(task.deadline);
    const today = new Date();

    deadline.setHours(23, 59, 59, 999);

    return deadline < today;
  };

  const inProgressTasks = tasks.filter((task) => isInProgress(task));

  const completedTasks = tasks.filter((task) => isCompleted(task));

  const overdueTasks = tasks.filter((task) => isOverdue(task));

  const pendingTasks = tasks.filter(
    (task) => !isCompleted(task) && !isInProgress(task),
  );

  const filteredTasks = useMemo(() => {
    switch (activeFilter) {
      case "in_progress":
        return inProgressTasks;

      case "completed":
        return completedTasks;

      case "overdue":
        return overdueTasks;

      default:
        return tasks;
    }
  }, [activeFilter, tasks, inProgressTasks, completedTasks, overdueTasks]);

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

  function openTaskDetails(task) {
    if (!task?.project_id || !task?.id) {
      setError("This task is missing its project information.");
      return;
    }

    navigate(`/projects/${task.project_id}/tasks/${task.id}`);
  }

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

  return (
    <div className="zyra-tasks">
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

        <div className="tasks-header-status">
          <span className="tasks-live-dot" />
          <span>WORKSPACE ACTIVE</span>
        </div>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      <div className="tasks-summary">
        <div className="task-summary-card">
          <div className="task-summary-icon">
            <CheckSquare size={18} />
          </div>

          <div className="task-summary-content">
            <span>Total Tasks</span>
            <strong>{loading ? "..." : tasks.length}</strong>
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
                  ? `Your Tasks (${tasks.length})`
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

          {loading ? (
            <div className="tasks-empty">
              <div className="tasks-empty-icon">
                <CheckSquare size={27} />
              </div>

              <h3>Loading your workspace...</h3>

              <p>Getting your assigned tasks from the ZYRA workspace.</p>
            </div>
          ) : filteredTasks.length === 0 ? (
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
            </div>
          ) : (
            <div className="task-list">
              {filteredTasks.map((task) => {
                const statusClass = getTaskStatusClass(task);
                const deadline = formatDeadline(task.deadline);

                return (
                  <article
                    className={`task-card task-card-${statusClass}`}
                    key={task.id}
                    onClick={() => openTaskDetails(task)}
                  >
                    <div className="task-card-top">
                      <span className="task-project-tag">
                        PROJECT #{task.project_id}
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
                      <h3>{task.title}</h3>

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

        <aside className="task-status-panel">
          <div className="task-status-header">
            <div>
              <span className="tasks-section-label">TASK STATUS</span>

              <h3>Distribution</h3>
            </div>

            <ListFilter size={16} />
          </div>

          <div className="task-status-total">
            <strong>{loading ? "..." : tasks.length}</strong>

            <span>Total assigned</span>
          </div>

          <div className="task-status-list">
            {statusDistribution.map((status) => {
              const percentage =
                tasks.length > 0
                  ? Math.round((status.value / tasks.length) * 100)
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

      {!loading && tasks.length > 0 && (
        <section className="tasks-recent-panel">
          <div className="tasks-recent-header">
            <div>
              <span className="tasks-section-label">TASK QUEUE</span>

              <h3>More Assigned Tasks</h3>
            </div>

            <span className="tasks-recent-count">{tasks.length} TASKS</span>
          </div>

          <div className="tasks-recent-grid">
            {tasks.slice(0, 3).map((task) => {
              const statusClass = getTaskStatusClass(task);

              return (
                <button
                  type="button"
                  className={`recent-task-card ${statusClass}`}
                  key={task.id}
                  onClick={() => openTaskDetails(task)}
                >
                  <div className="recent-task-accent" />

                  <div>
                    <span className="recent-task-project">
                      PROJECT #{task.project_id}
                    </span>

                    <h4>{task.title}</h4>

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
    </div>
  );
}

export default Tasks;
