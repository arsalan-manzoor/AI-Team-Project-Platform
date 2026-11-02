import { useEffect, useState } from "react";
import {
  ArrowLeft,
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
import { apiRequest } from "../services/api";

import "../styles/create-task.css";

/*
 * Validate and normalize dates into YYYY-MM-DD.
 */
function normalizeDateToISO(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const dateValue = value.trim();

  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return dateValue;
}

/*
 * Extract the actual user ID.
 */
function getMemberId(member) {
  return (
    member?.user_id ?? member?.userId ?? member?.user?.id ?? member?.id ?? ""
  );
}

/*
 * Get a readable member name.
 */
function getMemberName(member) {
  return (
    member?.name ||
    member?.user_name ||
    member?.username ||
    member?.user?.name ||
    member?.email ||
    member?.user?.email ||
    "Team Member"
  );
}

/*
 * Support different API response formats.
 */
function extractMembers(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.members)) {
    return response.members;
  }

  if (Array.isArray(response?.projectMembers)) {
    return response.projectMembers;
  }

  if (Array.isArray(response?.project_members)) {
    return response.project_members;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.members)) {
    return response.data.members;
  }

  if (Array.isArray(response?.data?.projectMembers)) {
    return response.data.projectMembers;
  }

  if (Array.isArray(response?.data?.project_members)) {
    return response.data.project_members;
  }

  return [];
}

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

  /*
   * Load project details, current user and members.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadCreateTaskData() {
      try {
        setLoadingData(true);
        setError("");
        setTeamMembers([]);

        const [userResponse, projectResponse] = await Promise.all([
          getCurrentUser(),
          getProjectById(projectId),
        ]);

        if (cancelled) {
          return;
        }

        const userData =
          userResponse?.user ??
          userResponse?.data?.user ??
          userResponse?.data ??
          userResponse;

        const projectData =
          projectResponse?.project ??
          projectResponse?.data?.project ??
          projectResponse?.data ??
          projectResponse;

        setUser(userData);

        if (!projectData) {
          throw new Error("Could not load the selected project.");
        }

        /*
         * Load project members and team members independently.
         */
        const memberRequests = [
          apiRequest(`/projects/${encodeURIComponent(projectId)}/members`),
        ];

        if (projectData.team_id || projectData.teamId) {
          memberRequests.push(
            getTeamMembers(projectData.team_id ?? projectData.teamId),
          );
        }

        const memberResults = await Promise.allSettled(memberRequests);

        if (cancelled) {
          return;
        }

        let projectMembers = [];
        let loadedTeamMembers = [];

        if (memberResults[0]?.status === "fulfilled") {
          projectMembers = extractMembers(memberResults[0].value);
        } else {
          console.error(
            "Failed to load direct project members:",
            memberResults[0]?.reason,
          );
        }

        if (memberResults[1]?.status === "fulfilled") {
          loadedTeamMembers = extractMembers(memberResults[1].value);
        } else if (memberResults[1]?.status === "rejected") {
          console.error(
            "Failed to load team members:",
            memberResults[1].reason,
          );
        }

        /*
         * Combine both sources and remove duplicates.
         */
        const membersByUserId = new Map();

        for (const member of [...loadedTeamMembers, ...projectMembers]) {
          const memberId = getMemberId(member);

          if (memberId === null || memberId === undefined || memberId === "") {
            continue;
          }

          const key = String(memberId);
          const existingMember = membersByUserId.get(key) || {};

          membersByUserId.set(key, {
            ...existingMember,
            ...member,
          });
        }

        const combinedMembers = Array.from(membersByUserId.values());

        /*
         * Get the logged-in user's ID.
         */
        const currentUserId =
          userData?.id === null ||
          userData?.id === undefined ||
          userData?.id === ""
            ? ""
            : String(userData.id);

        /*
         * Exclude the creator.
         * Only USER and TEAM_LEADER are eligible when
         * workspace role information is available.
         */
        const assignableMembers = combinedMembers.filter((member) => {
          const memberId = getMemberId(member);

          if (memberId === null || memberId === undefined || memberId === "") {
            return false;
          }

          if (currentUserId && String(memberId) === currentUserId) {
            return false;
          }

          const workspaceRole = member.workspace_role ?? member.workspaceRole;

          if (
            workspaceRole !== null &&
            workspaceRole !== undefined &&
            String(workspaceRole).trim() !== ""
          ) {
            const normalizedRole = String(workspaceRole).trim().toUpperCase();

            return ["USER", "TEAM_LEADER"].includes(normalizedRole);
          }

          return true;
        });

        setTeamMembers(assignableMembers);

        /*
         * Automatically select the first eligible member.
         */
        const firstMember = assignableMembers[0];
        const firstMemberId = firstMember ? getMemberId(firstMember) : "";

        setTask((currentTask) => ({
          ...currentTask,
          assignedTo:
            firstMemberId === null || firstMemberId === undefined
              ? ""
              : String(firstMemberId),
        }));

        if (
          combinedMembers.length === 0 &&
          memberResults.every((result) => result.status === "rejected")
        ) {
          setError(
            "Could not load project or team members. Please check the browser console and API response.",
          );
        }
      } catch (loadError) {
        console.error("Create task data loading error:", loadError);

        if (!cancelled) {
          setError(
            loadError.message || "Failed to load task creation information.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    }

    if (projectId) {
      void loadCreateTaskData();
    } else {
      setError("Project ID is missing.");
      setLoadingData(false);
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function getInitial(member) {
    return getMemberName(member).charAt(0).toUpperCase();
  }

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
    const selectedAssigneeId = event.target.value;

    if (
      user?.id !== null &&
      user?.id !== undefined &&
      selectedAssigneeId !== "" &&
      String(selectedAssigneeId) === String(user.id)
    ) {
      setError("You cannot assign this task to yourself.");
      return;
    }

    setError("");

    setTask((currentTask) => ({
      ...currentTask,
      assignedTo: selectedAssigneeId,
    }));
  }

  /*
   * Native date input change handler.
   * The browser returns YYYY-MM-DD.
   */
  function handleDateChange(event) {
    setTask((currentTask) => ({
      ...currentTask,
      deadline: event.target.value,
    }));

    setError("");
  }

  /*
   * Submit task.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!projectId) {
      setError("Project ID is missing.");
      return;
    }

    if (!task.name.trim()) {
      setError("Please enter a task title.");
      return;
    }

    if (!task.description.trim()) {
      setError("Please enter a task description.");
      return;
    }

    if (!task.assignedTo) {
      setError("Please select an assignee.");
      return;
    }

    /*
     * Prevent assigning the task to the creator.
     */
    if (
      user?.id !== null &&
      user?.id !== undefined &&
      String(task.assignedTo) === String(user.id)
    ) {
      setError(
        "You cannot assign a task to yourself. Please select another team member.",
      );
      return;
    }

    /*
     * Confirm selected user exists in the displayed list.
     */
    const selectedMember = teamMembers.find(
      (member) => String(getMemberId(member)) === String(task.assignedTo),
    );

    if (!selectedMember) {
      setError("Please select an available project or team member.");
      return;
    }

    /*
     * Validate due date.
     */
    if (!task.deadline) {
      setError("Please enter or select a due date.");
      return;
    }

    const normalizedDeadline = normalizeDateToISO(task.deadline);

    if (!normalizedDeadline) {
      setError("Please enter a valid due date.");
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
        deadline: normalizedDeadline,
      });

      alert("Task created successfully!");

      navigate(`/projects/${projectId}/tasks`);
    } catch (submitError) {
      console.error("Task creation error:", submitError);

      setError(submitError.message || "Failed to create task.");
    } finally {
      setLoading(false);
    }
  }

  const selectedMember = teamMembers.find(
    (member) => String(getMemberId(member)) === String(task.assignedTo),
  );

  return (
    <div className="zyra-create-page">
      {/* BACK BUTTON */}
      <button
        type="button"
        className="back-page-btn"
        onClick={() => navigate(`/projects/${projectId}/tasks`)}
        disabled={loading}
      >
        <ArrowLeft size={16} />
        Back to Project Tasks
      </button>

      {/* PAGE HEADING */}
      <div className="create-task-heading">
        <h1>CREATE TASK</h1>
        <p>Define the next piece of work</p>
      </div>

      {/* MAIN FORM */}
      <form className="zyra-create-form" onSubmit={handleSubmit}>
        {/* TASK TITLE */}
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

        {/* DESCRIPTION */}
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

        {/* DETAILS GRID */}
        <div className="create-task-details-grid">
          {/* ASSIGNEE */}
          <div className="create-task-field">
            <label htmlFor="task-assignee">ASSIGNEE</label>

            <div className="select-wrapper assignee-select-wrapper">
              <div className="assignee-select-icon">
                {selectedMember ? getInitial(selectedMember) : "U"}
              </div>

              <select
                id="task-assignee"
                value={task.assignedTo}
                onChange={handleAssigneeChange}
                disabled={loading || loadingData}
              >
                <option value="">
                  {loadingData
                    ? "Loading members..."
                    : teamMembers.length > 0
                      ? "Select Assignee"
                      : "No other members available"}
                </option>

                {teamMembers.map((member) => {
                  const memberId = getMemberId(member);

                  return (
                    <option key={String(memberId)} value={String(memberId)}>
                      {getMemberName(member)}
                    </option>
                  );
                })}
              </select>
            </div>

            <span className="field-helper">
              {loadingData
                ? "Loading project and team members..."
                : teamMembers.length > 0
                  ? `${teamMembers.length} eligible member${
                      teamMembers.length === 1 ? "" : "s"
                    } available`
                  : "No other eligible project or team members found"}
            </span>
          </div>

          {/* PRIORITY */}
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
                disabled={loading}
              >
                High
              </button>

              <button
                type="button"
                className={`priority-badge medium ${
                  task.priority === "medium" ? "active" : ""
                }`}
                onClick={() => handlePriorityChange("medium")}
                disabled={loading}
              >
                Medium
              </button>

              <button
                type="button"
                className={`priority-badge low ${
                  task.priority === "low" ? "active" : ""
                }`}
                onClick={() => handlePriorityChange("low")}
                disabled={loading}
              >
                Low
              </button>
            </div>
          </div>

          {/* STATUS */}
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
                disabled={loading}
              >
                To Do
              </button>

              <button
                type="button"
                className={`status-badge progress ${
                  task.status === "in_progress" ? "active" : ""
                }`}
                onClick={() => handleStatusChange("in_progress")}
                disabled={loading}
              >
                In Progress
              </button>

              <button
                type="button"
                className={`status-badge done ${
                  task.status === "completed" ? "active" : ""
                }`}
                onClick={() => handleStatusChange("completed")}
                disabled={loading}
              >
                Done
              </button>
            </div>
          </div>

          {/* DUE DATE */}
          <div className="create-task-field">
            <label htmlFor="task-deadline">DUE DATE</label>

            <div className="date-input-wrapper">
              <input
                id="task-deadline"
                type="date"
                value={task.deadline}
                onChange={handleDateChange}
                required
                disabled={loading}
                aria-label="Select or enter task due date"
              />
            </div>

            <span className="field-helper">
              Enter a date or click the calendar icon to select one.
            </span>
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <p className="create-task-error" role="alert">
            {error}
          </p>
        )}

        {/* ACTIONS */}
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
            disabled={
              loading ||
              loadingData ||
              !task.assignedTo ||
              teamMembers.length === 0
            }
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
