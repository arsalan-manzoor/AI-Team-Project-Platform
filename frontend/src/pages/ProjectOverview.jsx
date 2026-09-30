import {
  FolderKanban,
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  CircleCheck,
  Clock3,
  Users,
  CalendarDays,
  Plus,
  X,
  Paperclip,
  Pencil,
  Trash2,
  Save,
  Settings,
  UserPlus,
  TrendingUp,
  AlertTriangle,
  MoreHorizontal,
} from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { getProjectById } from "../services/ProjectService";
import { getProjectTasks } from "../services/taskService";
import { getTeamById, getTeamMembers } from "../services/teamService";

import {
  getProjectMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from "../services/milestoneService";

import {
  getProjectResources,
  createResource,
  updateResource,
  deleteResource,
} from "../services/resourceService";

import { getCurrentUser } from "../services/authService";

import "../styles/project-overview.css";

const RESOURCE_BASE_URL = "http://localhost:5000";

function ProjectOverview() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [resources, setResources] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =========================================================
     MILESTONE STATE
     ========================================================= */

  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [creatingMilestone, setCreatingMilestone] = useState(false);

  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneDescription, setMilestoneDescription] = useState("");
  const [milestoneDeadline, setMilestoneDeadline] = useState("");
  const [milestoneStatus, setMilestoneStatus] = useState("pending");

  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [updatingMilestoneId, setUpdatingMilestoneId] = useState(null);

  const [editMilestoneName, setEditMilestoneName] = useState("");
  const [editMilestoneDescription, setEditMilestoneDescription] = useState("");
  const [editMilestoneDeadline, setEditMilestoneDeadline] = useState("");
  const [editMilestoneStatus, setEditMilestoneStatus] = useState("pending");

  /* =========================================================
     RESOURCE STATE
     ========================================================= */

  const [showResourceForm, setShowResourceForm] = useState(false);
  const [creatingResource, setCreatingResource] = useState(false);

  const [resourceName, setResourceName] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceFile, setResourceFile] = useState(null);

  const [editingResourceId, setEditingResourceId] = useState(null);
  const [updatingResourceId, setUpdatingResourceId] = useState(null);

  const [editResourceName, setEditResourceName] = useState("");
  const [editResourceDescription, setEditResourceDescription] = useState("");
  const [editResourceUrl, setEditResourceUrl] = useState("");

  /* =========================================================
     LOAD PROJECT
     ========================================================= */

  useEffect(() => {
    async function loadProjectOverview() {
      try {
        setLoading(true);
        setError("");

        const projectData = await getProjectById(projectId);
        setProject(projectData);

        const loadedTasks = await getProjectTasks(projectId);

        setTasks(Array.isArray(loadedTasks) ? loadedTasks : []);

        const loadedMilestones = await getProjectMilestones(projectId);

        setMilestones(Array.isArray(loadedMilestones) ? loadedMilestones : []);

        const loadedResources = await getProjectResources(projectId);

        setResources(Array.isArray(loadedResources) ? loadedResources : []);

        try {
          const userData = await getCurrentUser();
          setCurrentUser(userData);
        } catch (userError) {
          console.error("Current user loading error:", userError);
          setCurrentUser(null);
        }

        if (projectData?.team_id) {
          try {
            await getTeamById(projectData.team_id);

            const members = await getTeamMembers(projectData.team_id);

            setTeamMembers(Array.isArray(members) ? members : []);
          } catch (teamError) {
            console.error("Project team loading error:", teamError);
            setTeamMembers([]);
          }
        }
      } catch (loadError) {
        console.error("Project overview loading error:", loadError);

        setError(loadError.message || "Failed to load project information.");
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      loadProjectOverview();
    }
  }, [projectId]);

  /* =========================================================
     TASK CALCULATIONS
     ========================================================= */

  const completedTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === "completed" ||
          task.status === "complete" ||
          task.status === "done",
      ),
    [tasks],
  );

  const activeTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status !== "completed" &&
          task.status !== "complete" &&
          task.status !== "done",
      ),
    [tasks],
  );

  const progressPercentage =
    tasks.length > 0
      ? Math.round((completedTasks.length / tasks.length) * 100)
      : 0;

  const overdueTasks = useMemo(() => {
    const today = new Date();

    return tasks.filter((task) => {
      if (!task.deadline) {
        return false;
      }

      const deadline = new Date(task.deadline);

      return (
        deadline < today &&
        task.status !== "completed" &&
        task.status !== "complete" &&
        task.status !== "done"
      );
    });
  }, [tasks]);

  /* =========================================================
     PROJECT DATA
     ========================================================= */

  const projectStatus = project?.status || project?.project_status || "Active";

  const projectDeadline =
    project?.deadline || project?.due_date || project?.end_date || null;

  const projectHealth = project?.health || project?.health_status || null;

  const projectBudget = project?.budget || project?.budget_percentage || null;

  const projectRisk = project?.risk || project?.risk_level || null;

  const formattedDeadline = projectDeadline
    ? new Date(projectDeadline).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";

  /* =========================================================
     MILESTONE HELPERS
     ========================================================= */

  function getMilestoneStatus(status) {
    const normalized = String(status || "").toLowerCase();

    if (
      normalized === "completed" ||
      normalized === "complete" ||
      normalized === "done"
    ) {
      return "done";
    }

    if (
      normalized === "in_progress" ||
      normalized === "in-progress" ||
      normalized === "active"
    ) {
      return "active";
    }

    return "pending";
  }

  function getMilestoneStatusLabel(status) {
    const normalized = String(status || "").toLowerCase();

    if (
      normalized === "completed" ||
      normalized === "complete" ||
      normalized === "done"
    ) {
      return "Done";
    }

    if (normalized === "in_progress" || normalized === "in-progress") {
      return "In Progress";
    }

    return "Pending";
  }

  /* =========================================================
     TASK HELPERS
     ========================================================= */

  function getTaskStatusLabel(status) {
    const normalized = String(status || "").toLowerCase();

    if (
      normalized === "completed" ||
      normalized === "complete" ||
      normalized === "done"
    ) {
      return "Done";
    }

    if (normalized === "in_progress" || normalized === "in-progress") {
      return "In Progress";
    }

    if (normalized === "review") {
      return "Review";
    }

    return "Pending";
  }

  function getTaskStatusClass(status) {
    const normalized = String(status || "").toLowerCase();

    if (
      normalized === "completed" ||
      normalized === "complete" ||
      normalized === "done"
    ) {
      return "done";
    }

    if (normalized === "in_progress" || normalized === "in-progress") {
      return "progress";
    }

    if (normalized === "review") {
      return "review";
    }

    return "pending";
  }

  function formatTaskDeadline(deadline) {
    if (!deadline) {
      return "—";
    }

    const date = new Date(deadline);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function getMemberName(member) {
    return (
      member?.name ||
      member?.full_name ||
      member?.username ||
      member?.email ||
      "Member"
    );
  }

  function getMemberInitials(member) {
    const name = getMemberName(member);
    const parts = name.trim().split(/\s+/);

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function getTaskAssignee(task) {
    return (
      task?.assigned_to_name ||
      task?.assignee_name ||
      task?.assigned_to_username ||
      task?.assignee ||
      "Unassigned"
    );
  }

  /* =========================================================
     CREATE MILESTONE
     ========================================================= */

  async function handleCreateMilestone(event) {
    event.preventDefault();

    const name = milestoneName.trim();
    const description = milestoneDescription.trim();

    if (!name) {
      setError("Please enter a milestone name.");
      return;
    }

    try {
      setCreatingMilestone(true);
      setError("");

      const newMilestone = await createMilestone({
        name,
        description,
        projectId: Number(projectId),
        deadline: milestoneDeadline || null,
        status: milestoneStatus,
      });

      setMilestones((current) => [...current, newMilestone]);

      setMilestoneName("");
      setMilestoneDescription("");
      setMilestoneDeadline("");
      setMilestoneStatus("pending");
      setShowMilestoneForm(false);
    } catch (createError) {
      console.error("Milestone creation error:", createError);

      setError(createError.message || "Failed to create milestone.");
    } finally {
      setCreatingMilestone(false);
    }
  }

  /* =========================================================
     EDIT MILESTONE
     ========================================================= */

  function startEditingMilestone(milestone) {
    setError("");

    setEditingMilestoneId(milestone.id);
    setEditMilestoneName(milestone.name || "");
    setEditMilestoneDescription(milestone.description || "");

    setEditMilestoneDeadline(
      milestone.deadline ? String(milestone.deadline).slice(0, 10) : "",
    );

    setEditMilestoneStatus(milestone.status || "pending");
  }

  function cancelEditingMilestone() {
    setEditingMilestoneId(null);
    setEditMilestoneName("");
    setEditMilestoneDescription("");
    setEditMilestoneDeadline("");
    setEditMilestoneStatus("pending");
  }

  async function handleUpdateMilestone(event, milestoneId) {
    event.preventDefault();

    const name = editMilestoneName.trim();
    const description = editMilestoneDescription.trim();

    if (!name) {
      setError("Please enter a milestone name.");
      return;
    }

    try {
      setUpdatingMilestoneId(milestoneId);
      setError("");

      const updatedMilestone = await updateMilestone(milestoneId, {
        name,
        description,
        deadline: editMilestoneDeadline || null,
        status: editMilestoneStatus,
      });

      setMilestones((current) =>
        current.map((milestone) =>
          milestone.id === milestoneId ? updatedMilestone : milestone,
        ),
      );

      cancelEditingMilestone();
    } catch (updateError) {
      console.error("Milestone update error:", updateError);

      setError(updateError.message || "Failed to update milestone.");
    } finally {
      setUpdatingMilestoneId(null);
    }
  }

  /* =========================================================
     DELETE MILESTONE
     ========================================================= */

  async function handleDeleteMilestone(milestoneId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this milestone?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setUpdatingMilestoneId(milestoneId);

      await deleteMilestone(milestoneId);

      setMilestones((current) =>
        current.filter((milestone) => milestone.id !== milestoneId),
      );
    } catch (deleteError) {
      console.error("Milestone deletion error:", deleteError);

      setError(deleteError.message || "Failed to delete milestone.");
    } finally {
      setUpdatingMilestoneId(null);
    }
  }

  /* =========================================================
     CREATE RESOURCE
     ========================================================= */

  async function handleCreateResource(event) {
    event.preventDefault();

    const name = resourceName.trim();
    const description = resourceDescription.trim();
    const url = resourceUrl.trim();

    if (!name) {
      setError("Please enter a resource name.");
      return;
    }

    if (!url && !resourceFile) {
      setError("Please provide a resource URL or choose a file.");
      return;
    }

    try {
      setCreatingResource(true);
      setError("");

      const newResource = await createResource({
        name,
        description,
        url,
        file: resourceFile,
        projectId: Number(projectId),
      });

      setResources((current) => [...current, newResource]);

      setResourceName("");
      setResourceDescription("");
      setResourceUrl("");
      setResourceFile(null);
      setShowResourceForm(false);
    } catch (createError) {
      console.error("Resource creation error:", createError);

      setError(createError.message || "Failed to create resource.");
    } finally {
      setCreatingResource(false);
    }
  }

  /* =========================================================
     RESOURCE PERMISSION
     ========================================================= */

  function canEditResource(resource) {
    if (!currentUser?.id || !resource?.uploaded_by) {
      return false;
    }

    return Number(resource.uploaded_by) === Number(currentUser.id);
  }

  /* =========================================================
     EDIT RESOURCE
     ========================================================= */

  function startEditingResource(resource) {
    setError("");

    setEditingResourceId(resource.id);
    setEditResourceName(resource.name || "");
    setEditResourceDescription(resource.description || "");
    setEditResourceUrl(resource.url || "");
  }

  function cancelEditingResource() {
    setEditingResourceId(null);
    setEditResourceName("");
    setEditResourceDescription("");
    setEditResourceUrl("");
  }

  async function handleUpdateResource(event, resourceId) {
    event.preventDefault();

    const name = editResourceName.trim();
    const description = editResourceDescription.trim();
    const url = editResourceUrl.trim();

    if (!name) {
      setError("Please enter a resource name.");
      return;
    }

    if (!url) {
      setError("Please enter a resource URL.");
      return;
    }

    try {
      setUpdatingResourceId(resourceId);
      setError("");

      const updatedResource = await updateResource(resourceId, {
        name,
        description,
        url,
      });

      setResources((current) =>
        current.map((resource) =>
          resource.id === resourceId ? updatedResource : resource,
        ),
      );

      cancelEditingResource();
    } catch (updateError) {
      console.error("Resource update error:", updateError);

      setError(updateError.message || "Failed to update resource.");
    } finally {
      setUpdatingResourceId(null);
    }
  }

  /* =========================================================
     DELETE RESOURCE
     ========================================================= */

  async function handleDeleteResource(resourceId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this resource?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setUpdatingResourceId(resourceId);

      await deleteResource(resourceId);

      setResources((current) =>
        current.filter((resource) => resource.id !== resourceId),
      );
    } catch (deleteError) {
      console.error("Resource deletion error:", deleteError);

      setError(deleteError.message || "Failed to delete resource.");
    } finally {
      setUpdatingResourceId(null);
    }
  }

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="zyra-project-overview">
      {/* TOPBAR */}

      <div className="project-page-topbar">
        <button
          type="button"
          className="project-back-button"
          onClick={() => navigate("/projects")}
        >
          <ArrowLeft size={16} />
          Projects
        </button>

        <div className="project-topbar-title">
          <FolderKanban size={17} />
          <span>Project Workspace</span>
        </div>
      </div>

      {error && <div className="project-overview-error">{error}</div>}

      {/* HERO */}

      <section className="project-hero-card">
        <div className="project-hero-content">
          <div className="project-hero-title-row">
            <div>
              <div className="project-hero-title-line">
                <h1>
                  {loading
                    ? "Loading Project..."
                    : project?.name || "Project Overview"}
                </h1>

                <span className="project-status-badge">
                  {String(projectStatus).toUpperCase()}
                  {tasks.length > 0 ? ` (${progressPercentage}%)` : ""}
                </span>
              </div>

              <p>
                {project?.description ||
                  "Manage your project, tasks, milestones, team and resources from one workspace."}
              </p>
            </div>
          </div>
        </div>

        <div className="project-hero-actions">
          <button
            type="button"
            className="project-action primary"
            onClick={() => navigate(`/projects/${projectId}/tasks/create`)}
          >
            <Plus size={16} />
            Create Task
          </button>

          <button
            type="button"
            className="project-action secondary"
            onClick={() => {
              if (project?.team_id) {
                navigate(`/teams/${project.team_id}`);
              }
            }}
            disabled={!project?.team_id}
          >
            <UserPlus size={16} />
            Invite Team
          </button>

          <button
            type="button"
            className="project-action secondary"
            onClick={() => navigate(`/projects/${projectId}/tasks`)}
          >
            <Pencil size={15} />
            Edit Project
          </button>

          <button
            type="button"
            className="project-action secondary disabled-action"
            disabled
            title="Project settings will be available later."
          >
            <Settings size={15} />
            Project Settings
          </button>
        </div>
      </section>

      {/* MAIN GRID */}

      <div className="project-dashboard-grid">
        {/* MAIN COLUMN */}

        <main className="project-main-column">
          {/* SUMMARY */}

          <section className="project-summary-grid">
            <div className="project-progress-card">
              <div
                className="project-progress-ring"
                style={{
                  "--progress": `${progressPercentage * 3.6}deg`,
                }}
              >
                <div className="project-progress-inner">
                  <span>OVERALL PROGRESS</span>

                  <strong>{loading ? "—" : `${progressPercentage}%`}</strong>

                  <small>
                    Completed: {completedTasks.length}/{tasks.length} Tasks
                  </small>
                </div>
              </div>
            </div>

            <div className="project-metric-grid">
              <div className="project-metric-card health">
                <div className="metric-card-top">
                  <span>Health:</span>
                  <TrendingUp size={17} />
                </div>

                <strong>
                  {projectHealth
                    ? String(projectHealth).toUpperCase()
                    : "ON TRACK"}
                </strong>

                <div className="metric-progress">
                  <span
                    style={{
                      width: `${Math.max(progressPercentage, 10)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="project-metric-card budget">
                <div className="metric-card-top">
                  <span>Budget:</span>
                  <FolderKanban size={16} />
                </div>

                <strong>
                  {projectBudget !== null && projectBudget !== undefined
                    ? `${projectBudget}%`
                    : "—"}
                </strong>

                <div className="metric-progress">
                  <span
                    style={{
                      width:
                        projectBudget !== null && projectBudget !== undefined
                          ? `${Math.min(Number(projectBudget) || 0, 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>

              <div className="project-metric-card risks">
                <div className="metric-card-top">
                  <span>Risks:</span>
                  <AlertTriangle size={17} />
                </div>

                <strong>
                  {projectRisk
                    ? String(projectRisk).toUpperCase()
                    : overdueTasks.length > 0
                      ? `${overdueTasks.length} OVERDUE`
                      : "LOW"}
                </strong>
              </div>

              <div className="project-metric-card deadline">
                <div className="metric-card-top">
                  <span>Deadline:</span>
                  <CalendarDays size={17} />
                </div>

                <strong>{formattedDeadline}</strong>
              </div>
            </div>
          </section>

          {/* ACTIVE TASKS */}

          <section className="project-panel active-tasks-panel">
            <div className="project-panel-header">
              <div>
                <h2>ACTIVE TASKS ({activeTasks.length})</h2>
              </div>

              <button
                type="button"
                className="sort-tasks-button"
                onClick={() => navigate(`/projects/${projectId}/tasks`)}
              >
                View all
                <ArrowRight size={14} />
              </button>
            </div>

            {activeTasks.length === 0 ? (
              <div className="project-empty-state compact">
                <CheckSquare size={24} />
                <span>No active tasks</span>
              </div>
            ) : (
              <div className="active-task-list">
                {activeTasks.slice(0, 6).map((task) => (
                  <button
                    type="button"
                    className="active-task-row"
                    key={task.id}
                    onClick={() =>
                      navigate(`/projects/${projectId}/tasks/${task.id}`)
                    }
                  >
                    <div className="task-row-check">
                      <span />
                    </div>

                    <div className="task-row-name">
                      {task.title || task.name || "Untitled Task"}
                    </div>

                    <div className="task-row-assignee">
                      <div className="task-mini-avatar">
                        {getMemberInitials({
                          name: getTaskAssignee(task),
                        })}
                      </div>

                      <span>{getTaskAssignee(task)}</span>
                    </div>

                    <span
                      className={`task-status-pill ${getTaskStatusClass(
                        task.status,
                      )}`}
                    >
                      {getTaskStatusLabel(task.status)}
                    </span>

                    <span className="task-row-deadline">
                      {formatTaskDeadline(task.deadline || task.due_date)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </main>

        {/* SIDE COLUMN */}

        <aside className="project-side-column">
          {/* TEAM — TOP */}

          <section className="project-panel team-panel">
            <div className="project-panel-header">
              <h2>TEAM MEMBERS ({teamMembers.length})</h2>

              <button
                type="button"
                className="panel-icon-button"
                onClick={() => {
                  if (project?.team_id) {
                    navigate(`/teams/${project.team_id}`);
                  }
                }}
                disabled={!project?.team_id}
              >
                <MoreHorizontal size={17} />
              </button>
            </div>

            {teamMembers.length === 0 ? (
              <div className="project-empty-state compact">
                <Users size={22} />
                <span>No team members</span>
              </div>
            ) : (
              <div className="team-member-list">
                {teamMembers.slice(0, 6).map((member) => (
                  <div
                    className="team-member-item"
                    key={member.id || member.user_id || getMemberName(member)}
                  >
                    <div className="team-member-avatar">
                      {getMemberInitials(member)}
                    </div>

                    <div className="team-member-info">
                      <strong>{getMemberName(member)}</strong>

                      {member.role && <span>{member.role}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {teamMembers.length > 6 && (
              <button
                type="button"
                className="team-more-button"
                onClick={() => navigate(`/teams/${project?.team_id}`)}
              >
                +{teamMembers.length - 6} more
              </button>
            )}
          </section>

          {/* ACTIVITY — SECOND */}

          <section className="project-panel activity-panel">
            <div className="project-panel-header">
              <h2>RECENT ACTIVITY</h2>

              <button type="button" className="panel-icon-button" disabled>
                <MoreHorizontal size={17} />
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="project-empty-state compact">
                <Clock3 size={22} />
                <span>No recent activity</span>
              </div>
            ) : (
              <div className="activity-list">
                {tasks.slice(0, 4).map((task, index) => {
                  const taskName = task.title || task.name || "Task";
                  const status = getTaskStatusLabel(task.status);

                  return (
                    <div
                      className="activity-item"
                      key={task.id || `${taskName}-${index}`}
                    >
                      <span className={`activity-dot activity-${index % 3}`} />

                      <div className="activity-content">
                        <p>
                          <strong>{getTaskAssignee(task)}</strong> — {taskName}
                        </p>

                        <span>{status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* =====================================================
          PROJECT MANAGEMENT
          ===================================================== */}

      <section className="project-management-panel">
        <div className="project-management-header">
          <div>
            <span className="management-eyebrow">PROJECT MANAGEMENT</span>

            <h2>Milestones & Resources</h2>

            <p>
              Manage the detailed project information without leaving the
              workspace.
            </p>
          </div>
        </div>

        {/* ===================================================
            RESOURCES
            =================================================== */}

        <div className="resources-management">
          <div className="resource-management-header">
            <div>
              <span className="management-eyebrow">RESOURCES</span>

              <h3>Project Resources</h3>
            </div>

            {!showResourceForm && (
              <button
                type="button"
                className="management-secondary-button"
                onClick={() => {
                  setShowResourceForm(true);
                  setError("");
                }}
              >
                <Plus size={15} />
                Add Resource
              </button>
            )}
          </div>

          {showResourceForm && (
            <form
              className="project-management-form"
              onSubmit={handleCreateResource}
            >
              <div className="management-form-grid">
                <div className="form-group">
                  <label>Resource Name</label>

                  <input
                    type="text"
                    placeholder="Enter resource name"
                    value={resourceName}
                    onChange={(event) => setResourceName(event.target.value)}
                    disabled={creatingResource}
                  />
                </div>

                <div className="form-group">
                  <label>Choose File</label>

                  <input
                    type="file"
                    onChange={(event) => {
                      const selectedFile = event.target.files?.[0] || null;
                      setResourceFile(selectedFile);
                    }}
                    disabled={creatingResource}
                  />

                  {resourceFile && <small>Selected: {resourceFile.name}</small>}
                </div>

                <div className="form-group">
                  <label>Resource URL</label>

                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={resourceUrl}
                    onChange={(event) => setResourceUrl(event.target.value)}
                    disabled={creatingResource}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Description</label>

                  <textarea
                    rows="2"
                    placeholder="Enter resource description"
                    value={resourceDescription}
                    onChange={(event) =>
                      setResourceDescription(event.target.value)
                    }
                    disabled={creatingResource}
                  />
                </div>
              </div>

              <div className="management-form-actions">
                <button
                  type="button"
                  className="management-secondary-button"
                  onClick={() => {
                    setShowResourceForm(false);
                    setResourceName("");
                    setResourceDescription("");
                    setResourceUrl("");
                    setResourceFile(null);
                    setError("");
                  }}
                  disabled={creatingResource}
                >
                  <X size={15} />
                  Cancel
                </button>

                <button
                  type="submit"
                  className="management-primary-button"
                  disabled={
                    creatingResource ||
                    !resourceName.trim() ||
                    (!resourceUrl.trim() && !resourceFile)
                  }
                >
                  <Plus size={15} />

                  {creatingResource ? "Adding..." : "Add Resource"}
                </button>
              </div>
            </form>
          )}

          {resources.length === 0 ? (
            <div className="project-empty-state">
              <Paperclip size={24} />
              <span>No resources added yet.</span>
            </div>
          ) : (
            <div className="resource-list">
              {resources.map((resource) =>
                editingResourceId === resource.id ? (
                  <form
                    className="management-item editing"
                    key={resource.id}
                    onSubmit={(event) =>
                      handleUpdateResource(event, resource.id)
                    }
                  >
                    <div className="management-form-grid">
                      <div className="form-group">
                        <label>Name</label>

                        <input
                          type="text"
                          value={editResourceName}
                          onChange={(event) =>
                            setEditResourceName(event.target.value)
                          }
                          disabled={updatingResourceId === resource.id}
                        />
                      </div>

                      <div className="form-group">
                        <label>URL</label>

                        <input
                          type="url"
                          value={editResourceUrl}
                          onChange={(event) =>
                            setEditResourceUrl(event.target.value)
                          }
                          disabled={updatingResourceId === resource.id}
                        />
                      </div>

                      <div className="form-group full-width">
                        <label>Description</label>

                        <textarea
                          rows="2"
                          value={editResourceDescription}
                          onChange={(event) =>
                            setEditResourceDescription(event.target.value)
                          }
                          disabled={updatingResourceId === resource.id}
                        />
                      </div>
                    </div>

                    <div className="management-form-actions">
                      <button
                        type="button"
                        className="management-secondary-button"
                        onClick={cancelEditingResource}
                        disabled={updatingResourceId === resource.id}
                      >
                        <X size={14} />
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="management-primary-button"
                        disabled={
                          updatingResourceId === resource.id ||
                          !editResourceName.trim() ||
                          !editResourceUrl.trim()
                        }
                      >
                        <Save size={14} />

                        {updatingResourceId === resource.id
                          ? "Saving..."
                          : "Save Changes"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="management-item" key={resource.id}>
                    <div className="management-item-info">
                      <div className="management-item-icon">
                        <Paperclip size={17} />
                      </div>

                      <div>
                        <strong>{resource.name}</strong>

                        {resource.description && <p>{resource.description}</p>}

                        {resource.file_path ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/projects/${projectId}/file`, {
                                state: {
                                  fileUrl: `${RESOURCE_BASE_URL}${resource.file_path}`,
                                  fileName: resource.file_name || resource.name,
                                  projectId: Number(projectId),
                                },
                              })
                            }
                          >
                            Open File
                          </button>
                        ) : resource.url ? (
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Resource
                          </a>
                        ) : null}

                        {resource.file_name && (
                          <span>{resource.file_name}</span>
                        )}
                      </div>
                    </div>

                    {canEditResource(resource) && (
                      <div className="management-item-actions">
                        <button
                          type="button"
                          className="management-icon-button"
                          onClick={() => startEditingResource(resource)}
                          disabled={updatingResourceId === resource.id}
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          type="button"
                          className="management-icon-button danger"
                          onClick={() => handleDeleteResource(resource.id)}
                          disabled={updatingResourceId === resource.id}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {/* ===================================================
            MILESTONES BELOW RESOURCES
            =================================================== */}

        <div className="milestones-management">
          <div className="resource-management-header">
            <div>
              <span className="management-eyebrow">MILESTONES</span>

              <h3>Project Milestones</h3>
            </div>

            {!showMilestoneForm && (
              <button
                type="button"
                className="management-secondary-button"
                onClick={() => {
                  setShowMilestoneForm(true);
                  setError("");
                }}
              >
                <Plus size={15} />
                Add Milestone
              </button>
            )}
          </div>

          {showMilestoneForm && (
            <form
              className="project-management-form"
              onSubmit={handleCreateMilestone}
            >
              <div className="management-form-grid">
                <div className="form-group">
                  <label>Milestone Name</label>

                  <input
                    type="text"
                    placeholder="Enter milestone name"
                    value={milestoneName}
                    onChange={(event) => setMilestoneName(event.target.value)}
                    disabled={creatingMilestone}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>Deadline</label>

                  <input
                    type="date"
                    value={milestoneDeadline}
                    onChange={(event) =>
                      setMilestoneDeadline(event.target.value)
                    }
                    disabled={creatingMilestone}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Description</label>

                  <textarea
                    rows="3"
                    placeholder="Enter milestone description"
                    value={milestoneDescription}
                    onChange={(event) =>
                      setMilestoneDescription(event.target.value)
                    }
                    disabled={creatingMilestone}
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>

                  <select
                    value={milestoneStatus}
                    onChange={(event) => setMilestoneStatus(event.target.value)}
                    disabled={creatingMilestone}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="management-form-actions">
                <button
                  type="button"
                  className="management-secondary-button"
                  onClick={() => {
                    setShowMilestoneForm(false);
                    setMilestoneName("");
                    setMilestoneDescription("");
                    setMilestoneDeadline("");
                    setMilestoneStatus("pending");
                    setError("");
                  }}
                  disabled={creatingMilestone}
                >
                  <X size={15} />
                  Cancel
                </button>

                <button
                  type="submit"
                  className="management-primary-button"
                  disabled={creatingMilestone || !milestoneName.trim()}
                >
                  <Plus size={15} />

                  {creatingMilestone ? "Creating..." : "Create Milestone"}
                </button>
              </div>
            </form>
          )}

          {milestones.length === 0 ? (
            <div className="project-empty-state">
              <CircleCheck size={24} />

              <span>No milestones added yet.</span>
            </div>
          ) : (
            <div className="management-list">
              {milestones.map((milestone) =>
                editingMilestoneId === milestone.id ? (
                  <form
                    className="management-item editing"
                    key={milestone.id}
                    onSubmit={(event) =>
                      handleUpdateMilestone(event, milestone.id)
                    }
                  >
                    <div className="management-edit-grid">
                      <div className="form-group">
                        <label>Name</label>

                        <input
                          type="text"
                          value={editMilestoneName}
                          onChange={(event) =>
                            setEditMilestoneName(event.target.value)
                          }
                          disabled={updatingMilestoneId === milestone.id}
                        />
                      </div>

                      <div className="form-group">
                        <label>Deadline</label>

                        <input
                          type="date"
                          value={editMilestoneDeadline}
                          onChange={(event) =>
                            setEditMilestoneDeadline(event.target.value)
                          }
                          disabled={updatingMilestoneId === milestone.id}
                        />
                      </div>

                      <div className="form-group">
                        <label>Description</label>

                        <textarea
                          rows="2"
                          value={editMilestoneDescription}
                          onChange={(event) =>
                            setEditMilestoneDescription(event.target.value)
                          }
                          disabled={updatingMilestoneId === milestone.id}
                        />
                      </div>

                      <div className="form-group">
                        <label>Status</label>

                        <select
                          value={editMilestoneStatus}
                          onChange={(event) =>
                            setEditMilestoneStatus(event.target.value)
                          }
                          disabled={updatingMilestoneId === milestone.id}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </div>

                    <div className="management-form-actions">
                      <button
                        type="button"
                        className="management-secondary-button"
                        onClick={cancelEditingMilestone}
                        disabled={updatingMilestoneId === milestone.id}
                      >
                        <X size={14} />
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="management-primary-button"
                        disabled={
                          updatingMilestoneId === milestone.id ||
                          !editMilestoneName.trim()
                        }
                      >
                        <Save size={14} />

                        {updatingMilestoneId === milestone.id
                          ? "Saving..."
                          : "Save Changes"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="management-item" key={milestone.id}>
                    <div className="management-item-info">
                      <div className="management-item-icon">
                        <CircleCheck size={17} />
                      </div>

                      <div>
                        <strong>{milestone.name}</strong>

                        {milestone.description && (
                          <p>{milestone.description}</p>
                        )}

                        <span>
                          {getMilestoneStatusLabel(milestone.status)}

                          {milestone.deadline &&
                            ` • ${formatTaskDeadline(milestone.deadline)}`}
                        </span>
                      </div>
                    </div>

                    <div className="management-item-actions">
                      <button
                        type="button"
                        className="management-icon-button"
                        onClick={() => startEditingMilestone(milestone)}
                        disabled={updatingMilestoneId === milestone.id}
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        type="button"
                        className="management-icon-button danger"
                        onClick={() => handleDeleteMilestone(milestone.id)}
                        disabled={updatingMilestoneId === milestone.id}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default ProjectOverview;
