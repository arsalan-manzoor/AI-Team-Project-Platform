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
  Search,
  List,
  LayoutGrid,
  ArrowUpDown,
  TrendingUp,
  CheckCircle2,
  CircleDot,
  Sparkles,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import {
  getProjects,
  updateProject,
  deleteProject,
} from "../services/ProjectService";

import { getTeams, getTeamMembers } from "../services/teamService";
import { getCurrentUser } from "../services/authService";

import "../styles/projects.css";

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

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All Projects");
  const [sortOrder, setSortOrder] = useState("name");
  const [viewMode, setViewMode] = useState("grid");

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

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    const search = searchTerm.trim().toLowerCase();

    if (search) {
      result = result.filter((project) => {
        const name = project.name?.toLowerCase() || "";
        const description = project.description?.toLowerCase() || "";

        return name.includes(search) || description.includes(search);
      });
    }

    /*
     * The current backend does not expose a project status field.
     * Therefore:
     * - All Projects = all projects
     * - Active = all current projects because existing UI treats them as active
     * - Planning / Completed are intentionally not fabricated
     */
    if (activeFilter === "All Projects" || activeFilter === "Active") {
      // Keep all current projects.
    }

    if (activeFilter === "Planning" || activeFilter === "Completed") {
      result = [];
    }

    result.sort((a, b) => {
      if (sortOrder === "newest") {
        return Number(b.id) - Number(a.id);
      }

      if (sortOrder === "oldest") {
        return Number(a.id) - Number(b.id);
      }

      return (a.name || "").localeCompare(b.name || "");
    });

    return result;
  }, [projects, searchTerm, activeFilter, sortOrder]);

  const totalCollaborators = projects.reduce((total, project) => {
    const count = memberCounts[project.team_id] || 0;

    return total + count;
  }, 0);

  const featuredProject =
    filteredProjects.length > 0 ? filteredProjects[0] : null;

  const secondaryProjects =
    filteredProjects.length > 1 ? filteredProjects.slice(1) : [];

  return (
    <div className="zyra-projects">
      {/* Background decoration */}
      <div className="projects-background-grid" />
      <div className="projects-background-glow projects-glow-one" />
      <div className="projects-background-glow projects-glow-two" />

      {/* Back */}
      <button className="back-page-btn" onClick={() => navigate("/dashboard")}>
        <ArrowLeft size={15} />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="projects-header">
        <div className="projects-heading">
          <div className="projects-title-row">
            <div className="projects-title-marker">
              <Sparkles size={15} />
            </div>

            <div>
              <p className="projects-eyebrow">PROJECT WORKSPACE</p>

              <h2>My Projects</h2>

              <p className="projects-subtitle">
                Manage your team's workspaces, tasks and progress
              </p>
            </div>
          </div>
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

      {/* Statistics */}
      <div className="projects-summary">
        <div className="project-summary-card">
          <div className="project-summary-icon">
            <FolderKanban size={19} />
          </div>

          <div className="project-summary-content">
            <strong>
              {loading ? "..." : String(projects.length).padStart(2, "0")}
            </strong>

            <span>Projects</span>
          </div>

          <TrendingUp className="summary-trend" size={17} />
        </div>

        <div className="project-summary-card">
          <div className="project-summary-icon">
            <CircleDot size={19} />
          </div>

          <div className="project-summary-content">
            <strong>—</strong>
            <span>Tasks</span>
          </div>

          <TrendingUp className="summary-trend" size={17} />
        </div>

        <div className="project-summary-card">
          <div className="project-summary-icon">
            <CheckCircle2 size={19} />
          </div>

          <div className="project-summary-content">
            <strong>—</strong>
            <span>Average Progress</span>
          </div>

          <TrendingUp className="summary-trend" size={17} />
        </div>

        <div className="project-summary-card">
          <div className="project-summary-icon">
            <Users size={19} />
          </div>

          <div className="project-summary-content">
            <strong>
              {loading ? "..." : String(totalCollaborators).padStart(2, "0")}
            </strong>

            <span>Teams</span>
          </div>

          <TrendingUp className="summary-trend" size={17} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="projects-toolbar">
        <div className="projects-search">
          <Search size={15} />

          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search projects"
          />
        </div>

        <div className="projects-filters">
          {["All Projects", "Active", "Planning", "Completed"].map((filter) => (
            <button
              key={filter}
              className={
                activeFilter === filter
                  ? "project-filter active"
                  : "project-filter"
              }
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="projects-toolbar-actions">
          <button
            className="projects-sort-btn"
            onClick={() =>
              setSortOrder((current) =>
                current === "name"
                  ? "newest"
                  : current === "newest"
                    ? "oldest"
                    : "name",
              )
            }
          >
            <ArrowUpDown size={14} />
            Sort by
          </button>

          <div className="projects-view-toggle">
            <button
              className={
                viewMode === "grid"
                  ? "view-toggle-btn active"
                  : "view-toggle-btn"
              }
              onClick={() => setViewMode("grid")}
              title="Grid view"
            >
              <LayoutGrid size={15} />
            </button>

            <button
              className={
                viewMode === "list"
                  ? "view-toggle-btn active"
                  : "view-toggle-btn"
              }
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Projects */}
      <section className="projects-panel">
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
        ) : filteredProjects.length === 0 ? (
          <div className="dashboard-empty">
            <Search size={30} />

            <h4>No matching projects</h4>

            <p>Try changing your search or filter.</p>
          </div>
        ) : (
          <>
            {/* Featured Project */}
            {featuredProject && (
              <div className="featured-project-card">
                <div className="featured-project-left">
                  <div className="featured-project-icon">
                    <FolderKanban size={22} />
                  </div>

                  <div className="featured-project-info">
                    <div className="featured-project-title">
                      <h3>{featuredProject.name}</h3>

                      <span className="project-status active">Active</span>
                    </div>

                    <p>
                      {featuredProject.description ||
                        "No description provided."}
                    </p>

                    <div className="featured-project-meta">
                      <div className="featured-progress">
                        <div className="progress-track">
                          <div className="progress-fill" />
                        </div>

                        <span>—</span>
                      </div>

                      <div className="featured-divider" />

                      <span>
                        <Users size={13} />
                        {memberCounts[featuredProject.team_id] || 0} Members
                      </span>

                      <div className="featured-divider" />

                      <span>
                        <CalendarDays size={13} />
                        Active Project
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  className="project-open-btn"
                  onClick={() => navigate(`/projects/${featuredProject.id}`)}
                >
                  Open Project
                </button>
              </div>
            )}

            {/* Secondary project cards */}
            {secondaryProjects.length > 0 && (
              <div
                className={
                  viewMode === "grid"
                    ? "project-list project-grid-view"
                    : "project-list project-list-view"
                }
              >
                {secondaryProjects.map((project) => {
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
                              <FolderKanban size={21} />
                            </div>

                            <div className="project-card-info">
                              <div className="project-card-title">
                                <h3>{project.name}</h3>

                                <span className="project-status">Status</span>
                              </div>

                              <p>
                                {project.description ||
                                  "No description provided."}
                              </p>

                              <div className="project-card-progress">
                                <div className="progress-label">
                                  <span>Progress</span>

                                  <span>—</span>
                                </div>

                                <div className="progress-track">
                                  <div className="progress-fill" />
                                </div>
                              </div>

                              <div className="project-card-meta">
                                <span>
                                  <Users size={13} />
                                  {teamMemberCount} Team
                                </span>

                                <span>
                                  <CalendarDays size={13} />
                                  Active
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="project-card-actions">
                            <button
                              className="project-open-btn"
                              onClick={() =>
                                navigate(`/projects/${project.id}`)
                              }
                            >
                              Open Project
                            </button>

                            {isCreator && (
                              <>
                                <button
                                  className="project-edit-btn"
                                  onClick={() => handleOpenEdit(project)}
                                  disabled={isDeleting}
                                  title="Edit project"
                                >
                                  <Pencil size={15} />
                                </button>

                                <button
                                  className="project-delete-btn"
                                  onClick={() => handleDeleteProject(project)}
                                  disabled={isDeleting}
                                  title="Delete project"
                                >
                                  <Trash2 size={15} />

                                  {isDeleting ? "Deleting..." : ""}
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
          </>
        )}
      </section>
    </div>
  );
}

export default Projects;
