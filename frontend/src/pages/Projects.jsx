import {
  FolderKanban,
  Plus,
  ArrowLeft,
  CalendarDays,
  Users,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import {
  getProjects,
  updateProject,
  deleteProject,
} from "../services/ProjectService";

import { getTeams, getTeamMembers } from "../services/teamService";
import { getCurrentUser } from "../services/authService";

function Projects() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [memberCounts, setMemberCounts] = useState({});

  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingProjectId, setEditingProjectId] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [updatingProjectId, setUpdatingProjectId] = useState(null);
  const [deletingProjectId, setDeletingProjectId] = useState(null);

  useEffect(() => {
    async function loadProjects() {
      try {
        setLoading(true);
        setError("");

        const [projectsData, teamsData, userData] = await Promise.all([
          getProjects(),
          getTeams(),
          getCurrentUser(),
        ]);

        const loadedProjects = Array.isArray(projectsData) ? projectsData : [];

        const loadedTeams = Array.isArray(teamsData) ? teamsData : [];

        setProjects(loadedProjects);
        setCurrentUser(userData);

        const counts = {};

        await Promise.all(
          loadedTeams.map(async (team) => {
            try {
              const members = await getTeamMembers(team.id);

              counts[team.id] = Array.isArray(members) ? members.length : 0;
            } catch (error) {
              console.error(
                `Failed to load members for team ${team.id}:`,
                error,
              );

              counts[team.id] = 0;
            }
          }),
        );

        setMemberCounts(counts);
      } catch (error) {
        console.error("Projects loading error:", error);

        setError(error.message || "Failed to load projects.");
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  function handleOpenEdit(project) {
    setEditingProjectId(project.id);
    setProjectName(project.name || "");
    setProjectDescription(project.description || "");
    setError("");
  }

  function handleCancelEdit() {
    setEditingProjectId(null);
    setProjectName("");
    setProjectDescription("");
  }

  async function handleUpdateProject(event) {
    event.preventDefault();

    const name = projectName.trim();
    const description = projectDescription.trim();

    if (!editingProjectId) {
      return;
    }

    if (!name) {
      setError("Please enter a project name.");
      return;
    }

    try {
      setUpdatingProjectId(editingProjectId);
      setError("");

      const updatedProject = await updateProject(editingProjectId, {
        name,
        description,
      });

      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === editingProjectId
            ? {
                ...project,
                ...updatedProject,
              }
            : project,
        ),
      );

      handleCancelEdit();
    } catch (error) {
      console.error("Project update error:", error);

      setError(error.message || "Failed to update project.");
    } finally {
      setUpdatingProjectId(null);
    }
  }

  async function handleDeleteProject(project) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${project.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingProjectId(project.id);
      setError("");

      await deleteProject(project.id);

      setProjects((currentProjects) =>
        currentProjects.filter(
          (currentProject) => currentProject.id !== project.id,
        ),
      );

      if (editingProjectId === project.id) {
        handleCancelEdit();
      }
    } catch (error) {
      console.error("Project deletion error:", error);

      setError(error.message || "Failed to delete project.");
    } finally {
      setDeletingProjectId(null);
    }
  }

  function isProjectCreator(project) {
    if (!currentUser?.id || !project?.created_by) {
      return false;
    }

    return Number(project.created_by) === Number(currentUser.id);
  }

  // Currently the backend does not have a project status field.
  // Therefore, all projects are treated as active for now.
  const activeProjects = projects;

  const totalCollaborators = projects.reduce((total, project) => {
    const count = memberCounts[project.team_id] || 0;

    return total + count;
  }, 0);

  return (
    <div className="zyra-projects">
      <button className="back-page-btn" onClick={() => navigate("/dashboard")}>
        <ArrowLeft size={15} />
        Back to Dashboard
      </button>

      <div className="projects-header">
        <div>
          <p className="projects-eyebrow">PROJECT WORKSPACE</p>

          <h2>My Projects</h2>

          <p className="projects-subtitle">
            Create, organize, and track everything your team is building.
          </p>
        </div>

        <button
          className="projects-create-btn"
          onClick={() => navigate("/projects/create")}
        >
          <Plus size={17} />
          Create Project
        </button>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      <div className="projects-summary">
        {/* Total Projects */}
        <div className="project-summary-card">
          <div className="project-summary-icon">
            <FolderKanban size={19} />
          </div>

          <div>
            <span>Total Projects</span>

            <strong>{loading ? "..." : projects.length}</strong>
          </div>
        </div>

        {/* Active Projects */}
        <div className="project-summary-card">
          <div className="project-summary-icon">
            <CalendarDays size={19} />
          </div>

          <div>
            <span>Active Projects</span>

            <strong>{loading ? "..." : activeProjects.length}</strong>
          </div>
        </div>

        {/* Collaborators */}
        <div className="project-summary-card">
          <div className="project-summary-icon">
            <Users size={19} />
          </div>

          <div>
            <span>Collaborators</span>

            <strong>{loading ? "..." : totalCollaborators}</strong>
          </div>
        </div>
      </div>

      <section className="projects-panel">
        <div className="projects-panel-header">
          <div>
            <h3>Your Projects</h3>

            <p>Projects you are currently working on</p>
          </div>
        </div>

        {loading ? (
          <div className="dashboard-empty">
            <FolderKanban size={30} />

            <h4>Loading projects...</h4>

            <p>Getting your projects from the ZYRA workspace.</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="dashboard-empty">
            <FolderKanban size={30} />

            <h4>No projects yet</h4>

            <p>Create your first project to start working with ZYRA.</p>

            <button
              className="empty-action"
              onClick={() => navigate("/projects/create")}
            >
              <Plus size={16} />
              Create Project
            </button>
          </div>
        ) : (
          <div className="project-list">
            {projects.map((project) => {
              const teamMemberCount = memberCounts[project.team_id] || 0;

              const isCreator = isProjectCreator(project);

              const isUpdating = updatingProjectId === project.id;

              const isDeleting = deletingProjectId === project.id;

              const isEditing = editingProjectId === project.id;

              return (
                <div className="project-card" key={project.id}>
                  {isEditing ? (
                    <form
                      className="project-edit-form"
                      onSubmit={handleUpdateProject}
                    >
                      <div className="project-edit-header">
                        <div>
                          <p className="projects-eyebrow">EDIT PROJECT</p>

                          <h3>Update Project</h3>
                        </div>

                        <button
                          type="button"
                          className="project-edit-cancel-btn"
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                          title="Cancel"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="form-group">
                        <label>Project Name</label>

                        <input
                          type="text"
                          value={projectName}
                          onChange={(event) =>
                            setProjectName(event.target.value)
                          }
                          placeholder="Enter project name"
                          disabled={isUpdating}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Description</label>

                        <textarea
                          value={projectDescription}
                          onChange={(event) =>
                            setProjectDescription(event.target.value)
                          }
                          placeholder="Enter project description"
                          rows="4"
                          disabled={isUpdating}
                        />
                      </div>

                      <div className="project-edit-actions">
                        <button
                          type="button"
                          className="project-edit-cancel-action"
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                        >
                          <X size={15} />
                          Cancel
                        </button>

                        <button
                          type="submit"
                          className="project-edit-save-action"
                          disabled={isUpdating}
                        >
                          <Save size={15} />
                          {isUpdating ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="project-card-main">
                        <div className="project-card-icon">
                          <FolderKanban size={22} />
                        </div>

                        <div className="project-card-info">
                          <h3>{project.name}</h3>

                          <p>
                            {project.description || "No description provided."}
                          </p>

                          <div className="project-card-meta">
                            <span>
                              <CalendarDays size={13} />
                              Active Project
                            </span>

                            <span>
                              <Users size={13} />
                              {teamMemberCount} Members
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="project-card-actions">
                        <button
                          className="project-open-btn"
                          onClick={() => navigate(`/projects/${project.id}`)}
                        >
                          Open Project
                          <ArrowLeft size={15} />
                        </button>

                        {isCreator && (
                          <>
                            <button
                              className="project-edit-btn"
                              onClick={() => handleOpenEdit(project)}
                              disabled={isDeleting}
                            >
                              <Pencil size={15} />
                              Edit
                            </button>

                            <button
                              className="project-delete-btn"
                              onClick={() => handleDeleteProject(project)}
                              disabled={isDeleting}
                            >
                              <Trash2 size={15} />

                              {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Projects;
