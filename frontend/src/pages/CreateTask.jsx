import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  CircleDot,
  Flag,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link,
  Code,
  Undo2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { createTask } from "../services/taskService";
import { getCurrentUser } from "../services/authService";
import { getProjectById } from "../services/ProjectService";
import { getTeamMembers } from "../services/teamService";

import "../styles/create-task.css";

function CreateTask() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [user, setUser] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

  const [task, setTask] = useState({
    name: "",
    description: "",
    assignedTo: "",
    priority: "medium",
    deadline: "",
    status: "todo",
  });

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCreateTaskData() {
      try {
        setLoadingData(true);
        setError("");

        const [userData, projectData] = await Promise.all([
          getCurrentUser(),
          getProjectById(projectId),
        ]);

        setUser(userData);

        let members = [];

        if (projectData?.team_id) {
          members = await getTeamMembers(projectData.team_id);
        }

        const safeMembers = Array.isArray(members) ? members : [];

        setTeamMembers(safeMembers);

        /*
         * Default assignee:
         * current logged-in user if they belong to the project team.
         * Otherwise use the first available team member.
         */
        const currentUserMember = safeMembers.find(
          (member) =>
            Number(member.id || member.user_id) === Number(userData?.id),
        );

        const firstMember = safeMembers[0];

        const defaultAssignee =
          currentUserMember?.id ||
          currentUserMember?.user_id ||
          firstMember?.id ||
          firstMember?.user_id ||
          "";

        setTask((currentTask) => ({
          ...currentTask,
          assignedTo: String(defaultAssignee),
        }));
      } catch (error) {
        console.error("Create task data loading error:", error);

        setError(error.message || "Failed to load task creation information.");
      } finally {
        setLoadingData(false);
      }
    }

    if (projectId) {
      loadCreateTaskData();
    }
  }, [projectId]);

  function handlePriorityChange(priority) {
    setTask((currentTask) => ({
      ...currentTask,
      priority,
    }));
  }

  function handleStatusChange(status) {
    setTask((currentTask) => ({
      ...currentTask,
      status,
    }));
  }

  function handleAssigneeChange(event) {
    setTask((currentTask) => ({
      ...currentTask,
      assignedTo: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!projectId) {
      setError("Project ID is missing.");
      return;
    }

    if (!task.assignedTo) {
      setError("Please select an assignee.");
      return;
    }

    try {
      setLoading(true);

      await createTask({
        title: task.name.trim(),
        description: task.description.trim(),
        projectId: Number(projectId),
        assignedTo: Number(task.assignedTo),
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

  function getMemberName(member) {
    return (
      member.name ||
      member.user_name ||
      member.username ||
      member.email ||
      "Team Member"
    );
  }

  function getMemberId(member) {
    return member.id || member.user_id;
  }

  function getInitial(member) {
    return getMemberName(member).charAt(0).toUpperCase();
  }

  return (
    <div className="zyra-create-page">
      {/* =====================================================
          BACK BUTTON
      ===================================================== */}

      <button
        type="button"
        className="back-page-btn"
        onClick={() => navigate(`/projects/${projectId}/tasks`)}
        disabled={loading}
      >
        <ArrowLeft size={16} />
        Back to Project Tasks
      </button>

      {/* =====================================================
          PAGE HEADING
      ===================================================== */}

      <div className="create-task-heading">
        <h1>CREATE TASK</h1>

        <p>Define the next piece of work</p>
      </div>

      {/* =====================================================
          MAIN FORM
      ===================================================== */}

      <form className="zyra-create-form" onSubmit={handleSubmit}>
        {/* ===================================================
            TASK TITLE
        =================================================== */}

        <div className="create-task-field task-title-field">
          <label htmlFor="task-name">TASK TITLE</label>

          <input
            id="task-name"
            type="text"
            placeholder="Enter the task title..."
            value={task.name}
            onChange={(event) =>
              setTask((currentTask) => ({
                ...currentTask,
                name: event.target.value,
              }))
            }
            required
            disabled={loading}
            autoComplete="off"
          />
        </div>

        {/* ===================================================
            DESCRIPTION
        =================================================== */}

        <div className="create-task-field description-field">
          <label htmlFor="task-description">DESCRIPTION</label>

          <div className="description-editor">
            <div className="description-toolbar">
              <button type="button" aria-label="Bold">
                <Bold size={15} />
              </button>

              <button type="button" aria-label="Italic">
                <Italic size={15} />
              </button>

              <span className="toolbar-divider"></span>

              <button type="button" aria-label="Bulleted list">
                <List size={15} />
              </button>

              <button type="button" aria-label="Numbered list">
                <ListOrdered size={15} />
              </button>

              <button type="button" aria-label="Insert link">
                <Link size={15} />
              </button>

              <button type="button" aria-label="Code">
                <Code size={15} />
              </button>

              <button type="button" aria-label="Undo">
                <Undo2 size={15} />
              </button>
            </div>

            <textarea
              id="task-description"
              placeholder="Describe what needs to be completed..."
              value={task.description}
              onChange={(event) =>
                setTask((currentTask) => ({
                  ...currentTask,
                  description: event.target.value,
                }))
              }
              required
              disabled={loading}
            />
          </div>
        </div>

        {/* ===================================================
            DETAILS GRID
        =================================================== */}

        <div className="create-task-details-grid">
          {/* =================================================
              ASSIGNEE
          ================================================= */}

          <div className="create-task-field">
            <label htmlFor="task-assignee">ASSIGNEE</label>

            <div className="select-wrapper assignee-select-wrapper">
              <div className="assignee-select-icon">
                {task.assignedTo
                  ? getInitial(
                      teamMembers.find(
                        (member) =>
                          String(getMemberId(member)) ===
                          String(task.assignedTo),
                      ) || {},
                    )
                  : "U"}
              </div>

              <select
                id="task-assignee"
                value={task.assignedTo}
                onChange={handleAssigneeChange}
                disabled={loading || loadingData}
              >
                <option value="">
                  {loadingData ? "Loading members..." : "Select Assignee"}
                </option>

                {teamMembers.map((member) => (
                  <option key={getMemberId(member)} value={getMemberId(member)}>
                    {getMemberName(member)}
                  </option>
                ))}
              </select>
            </div>

            <span className="field-helper">
              {teamMembers.length > 0
                ? `${teamMembers.length} team member${
                    teamMembers.length === 1 ? "" : "s"
                  } available`
                : "No team members found"}
            </span>
          </div>

          {/* =================================================
              PRIORITY
          ================================================= */}

          <div className="create-task-field">
            <label htmlFor="task-priority">PRIORITY</label>

            <div className="select-wrapper">
              <Flag size={14} />

              <select
                id="task-priority"
                value={task.priority}
                onChange={(event) => handlePriorityChange(event.target.value)}
                disabled={loading}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="option-badges priority-badges">
              <button
                type="button"
                className={`priority-badge high ${
                  task.priority === "high" ? "active" : ""
                }`}
                onClick={() => handlePriorityChange("high")}
              >
                High
              </button>

              <button
                type="button"
                className={`priority-badge medium ${
                  task.priority === "medium" ? "active" : ""
                }`}
                onClick={() => handlePriorityChange("medium")}
              >
                Medium
              </button>

              <button
                type="button"
                className={`priority-badge low ${
                  task.priority === "low" ? "active" : ""
                }`}
                onClick={() => handlePriorityChange("low")}
              >
                Low
              </button>
            </div>
          </div>

          {/* =================================================
              STATUS
          ================================================= */}

          <div className="create-task-field">
            <label htmlFor="task-status">STATUS</label>

            <div className="select-wrapper">
              <CircleDot size={14} />

              <select
                id="task-status"
                value={task.status}
                onChange={(event) => handleStatusChange(event.target.value)}
                disabled={loading}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="option-badges status-badges">
              <button
                type="button"
                className={`status-badge todo ${
                  task.status === "todo" ? "active" : ""
                }`}
                onClick={() => handleStatusChange("todo")}
              >
                To Do
              </button>

              <button
                type="button"
                className={`status-badge progress ${
                  task.status === "in_progress" ? "active" : ""
                }`}
                onClick={() => handleStatusChange("in_progress")}
              >
                In Progress
              </button>

              <button
                type="button"
                className={`status-badge done ${
                  task.status === "completed" ? "active" : ""
                }`}
                onClick={() => handleStatusChange("completed")}
              >
                Done
              </button>
            </div>
          </div>

          {/* =================================================
              DUE DATE
          ================================================= */}

          <div className="create-task-field">
            <label htmlFor="task-deadline">DUE DATE</label>

            <div className="date-input-wrapper">
              <input
                id="task-deadline"
                type="date"
                value={task.deadline}
                onChange={(event) =>
                  setTask((currentTask) => ({
                    ...currentTask,
                    deadline: event.target.value,
                  }))
                }
                required
                disabled={loading}
              />

              <CalendarDays size={15} />
            </div>

            <span className="field-helper">Select Date</span>
          </div>
        </div>

        {/* ===================================================
            ERROR
        =================================================== */}

        {error && <p className="create-task-error">{error}</p>}

        {/* ===================================================
            ACTIONS
        =================================================== */}

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
            disabled={loading || loadingData || !task.assignedTo}
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
