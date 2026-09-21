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
} from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

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

  // Milestone creation
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [creatingMilestone, setCreatingMilestone] = useState(false);

  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneDescription, setMilestoneDescription] = useState("");
  const [milestoneDeadline, setMilestoneDeadline] = useState("");
  const [milestoneStatus, setMilestoneStatus] = useState("pending");

  // Milestone editing
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [updatingMilestoneId, setUpdatingMilestoneId] = useState(null);

  const [editMilestoneName, setEditMilestoneName] = useState("");
  const [editMilestoneDescription, setEditMilestoneDescription] = useState("");
  const [editMilestoneDeadline, setEditMilestoneDeadline] = useState("");
  const [editMilestoneStatus, setEditMilestoneStatus] = useState("pending");

  // Resource creation
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [creatingResource, setCreatingResource] = useState(false);

  const [resourceName, setResourceName] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");

  // Resource editing
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [updatingResourceId, setUpdatingResourceId] = useState(null);

  const [editResourceName, setEditResourceName] = useState("");
  const [editResourceDescription, setEditResourceDescription] = useState("");
  const [editResourceUrl, setEditResourceUrl] = useState("");

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
      } catch (error) {
        console.error("Project overview loading error:", error);

        setError(error.message || "Failed to load project information.");
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      loadProjectOverview();
    }
  }, [projectId]);

  const completedTasks = tasks.filter(
    (task) =>
      task.status === "completed" ||
      task.status === "complete" ||
      task.status === "done",
  ).length;

  const pendingTasks = tasks.filter(
    (task) => task.status === "pending" || task.status === "todo",
  ).length;

  // -----------------------------
  // CREATE MILESTONE
  // -----------------------------

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

      setMilestones((currentMilestones) => [
        ...currentMilestones,
        newMilestone,
      ]);

      setMilestoneName("");
      setMilestoneDescription("");
      setMilestoneDeadline("");
      setMilestoneStatus("pending");
      setShowMilestoneForm(false);
    } catch (error) {
      console.error("Milestone creation error:", error);

      setError(error.message || "Failed to create milestone.");
    } finally {
      setCreatingMilestone(false);
    }
  }

  // -----------------------------
  // EDIT MILESTONE
  // -----------------------------

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

      setMilestones((currentMilestones) =>
        currentMilestones.map((milestone) =>
          milestone.id === milestoneId ? updatedMilestone : milestone,
        ),
      );

      cancelEditingMilestone();
    } catch (error) {
      console.error("Milestone update error:", error);

      setError(error.message || "Failed to update milestone.");
    } finally {
      setUpdatingMilestoneId(null);
    }
  }

  // -----------------------------
  // DELETE MILESTONE
  // -----------------------------

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

      setMilestones((currentMilestones) =>
        currentMilestones.filter((milestone) => milestone.id !== milestoneId),
      );
    } catch (error) {
      console.error("Milestone deletion error:", error);

      setError(error.message || "Failed to delete milestone.");
    } finally {
      setUpdatingMilestoneId(null);
    }
  }

  // -----------------------------
  // CREATE RESOURCE
  // -----------------------------

  async function handleCreateResource(event) {
    event.preventDefault();

    const name = resourceName.trim();
    const description = resourceDescription.trim();
    const url = resourceUrl.trim();

    if (!name) {
      setError("Please enter a resource name.");
      return;
    }

    if (!url) {
      setError("Please enter a resource URL.");
      return;
    }

    try {
      setCreatingResource(true);
      setError("");

      const newResource = await createResource({
        name,
        description,
        url,
        projectId: Number(projectId),
      });

      setResources((currentResources) => [...currentResources, newResource]);

      setResourceName("");
      setResourceDescription("");
      setResourceUrl("");
      setShowResourceForm(false);
    } catch (error) {
      console.error("Resource creation error:", error);

      setError(error.message || "Failed to create resource.");
    } finally {
      setCreatingResource(false);
    }
  }

  // -----------------------------
  // RESOURCE OWNERSHIP
  // -----------------------------

  function canEditResource(resource) {
    if (!currentUser?.id || !resource?.uploaded_by) {
      return false;
    }

    return Number(resource.uploaded_by) === Number(currentUser.id);
  }

  // -----------------------------
  // EDIT RESOURCE
  // -----------------------------

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

      setResources((currentResources) =>
        currentResources.map((resource) =>
          resource.id === resourceId ? updatedResource : resource,
        ),
      );

      cancelEditingResource();
    } catch (error) {
      console.error("Resource update error:", error);

      setError(error.message || "Failed to update resource.");
    } finally {
      setUpdatingResourceId(null);
    }
  }

  // -----------------------------
  // DELETE RESOURCE
  // -----------------------------

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

      setResources((currentResources) =>
        currentResources.filter((resource) => resource.id !== resourceId),
      );
    } catch (error) {
      console.error("Resource deletion error:", error);

      setError(error.message || "Failed to delete resource.");
    } finally {
      setUpdatingResourceId(null);
    }
  }

  return (
    <div className="zyra-project-overview">
      {/* Back to Projects */}
      <button
        type="button"
        className="back-page-btn"
        onClick={() => navigate("/projects")}
      >
        <ArrowLeft size={16} />
        Back to Projects
      </button>

      {/* Error */}
      {error && <div className="dashboard-error">{error}</div>}

      {/* Project Header */}
      <div className="project-overview-header">
        <div className="project-overview-title">
          <div className="project-overview-icon">
            <FolderKanban size={22} />
          </div>

          <div>
            <p className="project-overview-eyebrow">PROJECT WORKSPACE</p>

            <h2>
              {loading
                ? "Loading Project..."
                : project?.name || "Project Overview"}
            </h2>

            <p>
              {project?.description ||
                "View your project's progress, tasks, and team information."}
            </p>
          </div>
        </div>

        {/* View Project Tasks */}
        <button
          type="button"
          className="project-overview-tasks-btn"
          onClick={() => navigate(`/projects/${projectId}/tasks`)}
        >
          <CheckSquare size={16} />
          View Project Tasks
          <ArrowRight size={15} />
        </button>
      </div>

      {/* Project Information */}
      <section className="project-overview-panel">
        <div className="project-overview-panel-header">
          <div>
            <h3>Project Information</h3>

            <p>Basic information about this project.</p>
          </div>
        </div>

        <div className="project-overview-info">
          <div className="project-info-item">
            <span>Project Name</span>

            <strong>{loading ? "Loading..." : project?.name || "—"}</strong>
          </div>

          <div className="project-info-item">
            <span>Status</span>

            <strong>Active</strong>
          </div>

          <div className="project-info-item">
            <span>Project ID</span>

            <strong>{projectId}</strong>
          </div>

          <div className="project-info-item">
            <span>Description</span>

            <strong>
              {project?.description || "No description provided."}
            </strong>
          </div>
        </div>
      </section>

      {/* Project Statistics */}
      <div className="project-overview-summary">
        <div className="project-overview-stat-card">
          <div className="project-overview-stat-icon">
            <CheckSquare size={19} />
          </div>

          <div>
            <span>Total Tasks</span>

            <strong>{loading ? "..." : tasks.length}</strong>
          </div>
        </div>

        <div className="project-overview-stat-card">
          <div className="project-overview-stat-icon">
            <CircleCheck size={19} />
          </div>

          <div>
            <span>Completed</span>

            <strong>{loading ? "..." : completedTasks}</strong>
          </div>
        </div>

        <div className="project-overview-stat-card">
          <div className="project-overview-stat-icon">
            <Clock3 size={19} />
          </div>

          <div>
            <span>Pending</span>

            <strong>{loading ? "..." : pendingTasks}</strong>
          </div>
        </div>

        <div className="project-overview-stat-card">
          <div className="project-overview-stat-icon">
            <Users size={19} />
          </div>

          <div>
            <span>Team Members</span>

            <strong>{loading ? "..." : teamMembers.length}</strong>
          </div>
        </div>
      </div>

      {/* Project Details */}
      <section className="project-overview-panel">
        <div className="project-overview-panel-header">
          <div>
            <h3>Project Details</h3>

            <p>Current project information and timeline.</p>
          </div>
        </div>

        <div className="project-details-grid">
          <div className="project-detail-card">
            <CalendarDays size={18} />

            <div>
              <span>Timeline</span>

              <strong>Active Project</strong>
            </div>
          </div>

          <div className="project-detail-card">
            <Users size={18} />

            <div>
              <span>Collaborators</span>

              <strong>
                {loading ? "..." : `${teamMembers.length} Members`}
              </strong>
            </div>
          </div>

          <div className="project-detail-card">
            <FolderKanban size={18} />

            <div>
              <span>Workspace</span>

              <strong>ZYRA Workspace</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Project Milestones */}
      <section className="project-overview-panel">
        <div className="project-overview-panel-header">
          <div>
            <h3>Project Milestones</h3>

            <p>Important checkpoints and goals for this project.</p>
          </div>

          {!showMilestoneForm && (
            <button
              type="button"
              className="project-overview-tasks-btn"
              onClick={() => {
                setShowMilestoneForm(true);
                setError("");
              }}
            >
              <Plus size={16} />
              Add Milestone
            </button>
          )}
        </div>

        {/* Create Milestone Form */}
        {showMilestoneForm && (
          <form className="task-subtask-form" onSubmit={handleCreateMilestone}>
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
              <label>Description</label>

              <textarea
                placeholder="Enter milestone description"
                value={milestoneDescription}
                onChange={(event) =>
                  setMilestoneDescription(event.target.value)
                }
                disabled={creatingMilestone}
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Deadline</label>

              <input
                type="date"
                value={milestoneDeadline}
                onChange={(event) => setMilestoneDeadline(event.target.value)}
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

            <div className="task-subtask-form-actions">
              <button
                type="button"
                className="cancel-form-btn"
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
                className="submit-project-btn"
                disabled={creatingMilestone || !milestoneName.trim()}
              >
                <Plus size={15} />

                {creatingMilestone ? "Creating..." : "Create Milestone"}
              </button>
            </div>
          </form>
        )}

        {/* Milestone List */}
        {milestones.length === 0 ? (
          <div className="project-details-empty">
            <FolderKanban size={28} />

            <h3>No milestones yet</h3>

            <p>Create milestones to track important stages of your project.</p>
          </div>
        ) : (
          <div className="project-details-grid">
            {milestones.map((milestone) =>
              editingMilestoneId === milestone.id ? (
                <form
                  className="project-detail-card"
                  key={milestone.id}
                  onSubmit={(event) =>
                    handleUpdateMilestone(event, milestone.id)
                  }
                >
                  <CircleCheck size={18} />

                  <div>
                    <div className="form-group">
                      <label>Milestone Name</label>

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
                      <label>Description</label>

                      <textarea
                        rows="3"
                        value={editMilestoneDescription}
                        onChange={(event) =>
                          setEditMilestoneDescription(event.target.value)
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

                    <div className="task-subtask-form-actions">
                      <button
                        type="button"
                        className="cancel-form-btn"
                        onClick={cancelEditingMilestone}
                        disabled={updatingMilestoneId === milestone.id}
                      >
                        <X size={15} />
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="submit-project-btn"
                        disabled={
                          updatingMilestoneId === milestone.id ||
                          !editMilestoneName.trim()
                        }
                      >
                        <Save size={15} />

                        {updatingMilestoneId === milestone.id
                          ? "Saving..."
                          : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="project-detail-card" key={milestone.id}>
                  <CircleCheck size={18} />

                  <div>
                    <span>{milestone.name}</span>

                    <strong>{milestone.status || "Pending"}</strong>

                    {milestone.description && (
                      <small>{milestone.description}</small>
                    )}

                    {milestone.deadline && (
                      <small>
                        Deadline: {String(milestone.deadline).slice(0, 10)}
                      </small>
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginTop: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        className="cancel-form-btn"
                        onClick={() => startEditingMilestone(milestone)}
                        disabled={updatingMilestoneId === milestone.id}
                      >
                        <Pencil size={14} />
                        Edit
                      </button>

                      <button
                        type="button"
                        className="cancel-form-btn"
                        onClick={() => handleDeleteMilestone(milestone.id)}
                        disabled={updatingMilestoneId === milestone.id}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      {/* Project Resources */}
      <section className="project-overview-panel">
        <div className="project-overview-panel-header">
          <div>
            <h3>Project Resources</h3>

            <p>Useful links and resources shared for this project.</p>
          </div>

          {!showResourceForm && (
            <button
              type="button"
              className="project-overview-tasks-btn"
              onClick={() => {
                setShowResourceForm(true);
                setError("");
              }}
            >
              <Plus size={16} />
              Add Resource
            </button>
          )}
        </div>

        {/* Create Resource Form */}
        {showResourceForm && (
          <form className="task-subtask-form" onSubmit={handleCreateResource}>
            <div className="form-group">
              <label>Resource Name</label>

              <input
                type="text"
                placeholder="Enter resource name"
                value={resourceName}
                onChange={(event) => setResourceName(event.target.value)}
                disabled={creatingResource}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Description</label>

              <textarea
                placeholder="Enter resource description"
                value={resourceDescription}
                onChange={(event) => setResourceDescription(event.target.value)}
                disabled={creatingResource}
                rows="3"
              />
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

            <div className="task-subtask-form-actions">
              <button
                type="button"
                className="cancel-form-btn"
                onClick={() => {
                  setShowResourceForm(false);
                  setResourceName("");
                  setResourceDescription("");
                  setResourceUrl("");
                  setError("");
                }}
                disabled={creatingResource}
              >
                <X size={15} />
                Cancel
              </button>

              <button
                type="submit"
                className="submit-project-btn"
                disabled={
                  creatingResource ||
                  !resourceName.trim() ||
                  !resourceUrl.trim()
                }
              >
                <Plus size={15} />

                {creatingResource ? "Adding..." : "Add Resource"}
              </button>
            </div>
          </form>
        )}

        {/* Resource List */}
        {resources.length === 0 ? (
          <div className="project-details-empty">
            <Paperclip size={28} />

            <h3>No resources yet</h3>

            <p>Add useful links and resources for your project team.</p>
          </div>
        ) : (
          <div className="project-details-grid">
            {resources.map((resource) =>
              editingResourceId === resource.id ? (
                <form
                  className="project-detail-card"
                  key={resource.id}
                  onSubmit={(event) => handleUpdateResource(event, resource.id)}
                >
                  <Paperclip size={18} />

                  <div>
                    <div className="form-group">
                      <label>Resource Name</label>

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
                      <label>Description</label>

                      <textarea
                        rows="3"
                        value={editResourceDescription}
                        onChange={(event) =>
                          setEditResourceDescription(event.target.value)
                        }
                        disabled={updatingResourceId === resource.id}
                      />
                    </div>

                    <div className="form-group">
                      <label>Resource URL</label>

                      <input
                        type="url"
                        value={editResourceUrl}
                        onChange={(event) =>
                          setEditResourceUrl(event.target.value)
                        }
                        disabled={updatingResourceId === resource.id}
                      />
                    </div>

                    <div className="task-subtask-form-actions">
                      <button
                        type="button"
                        className="cancel-form-btn"
                        onClick={cancelEditingResource}
                        disabled={updatingResourceId === resource.id}
                      >
                        <X size={15} />
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="submit-project-btn"
                        disabled={
                          updatingResourceId === resource.id ||
                          !editResourceName.trim() ||
                          !editResourceUrl.trim()
                        }
                      >
                        <Save size={15} />

                        {updatingResourceId === resource.id
                          ? "Saving..."
                          : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="project-detail-card" key={resource.id}>
                  <Paperclip size={18} />

                  <div>
                    <span>{resource.name}</span>

                    {resource.description && (
                      <small>{resource.description}</small>
                    )}

                    <a href={resource.url} target="_blank" rel="noreferrer">
                      Open Resource
                    </a>

                    {canEditResource(resource) && (
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          marginTop: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="cancel-form-btn"
                          onClick={() => startEditingResource(resource)}
                          disabled={updatingResourceId === resource.id}
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                        <button
                          type="button"
                          className="cancel-form-btn"
                          onClick={() => handleDeleteResource(resource.id)}
                          disabled={updatingResourceId === resource.id}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default ProjectOverview;
