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
import { apiRequest } from "../services/api";
import { useWorkspace } from "../context/WorkspaceContext";

import "../styles/projects.css";

// ============================================================
// RESPONSE HELPERS
// ============================================================

function getResponseArray(response, key) {
  if (Array.isArray(response)) {
    return response;
  }

  if (key && Array.isArray(response?.[key])) {
    return response[key];
  }

  if (key && Array.isArray(response?.data?.[key])) {
    return response.data[key];
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function getProjectId(project) {
  return project?.id ?? project?.project_id ?? project?.projectId;
}

function getProjectTeamId(project) {
  return project?.team_id ?? project?.teamId ?? project?.team?.id;
}

function getTeamId(team) {
  return team?.id ?? team?.team_id ?? team?.teamId;
}

function getTeamWorkspaceId(team) {
  return team?.workspace_id ?? team?.workspaceId ?? team?.workspace?.id;
}

function getProjectWorkspaceId(project) {
  return (
    project?.workspace_id ?? project?.workspaceId ?? project?.workspace?.id
  );
}

function getTeamLeaderId(team) {
  return (
    team?.team_leader_id ??
    team?.teamLeaderId ??
    team?.leader_id ??
    team?.leaderId
  );
}

function getTeamCreatorId(team) {
  return (
    team?.created_by ?? team?.createdBy ?? team?.creator_id ?? team?.creatorId
  );
}

function sameId(first, second) {
  if (
    first === null ||
    first === undefined ||
    second === null ||
    second === undefined
  ) {
    return false;
  }

  return String(first) === String(second);
}

function isTeamUnderLeader(team, userId) {
  const assignedLeaderId = getTeamLeaderId(team);

  if (
    assignedLeaderId !== null &&
    assignedLeaderId !== undefined &&
    assignedLeaderId !== ""
  ) {
    return sameId(assignedLeaderId, userId);
  }

  return sameId(getTeamCreatorId(team), userId);
}

function getProjectMemberUserId(member) {
  return (
    member?.user_id ??
    member?.userId ??
    member?.user?.id ??
    member?.account_id ??
    member?.accountId
  );
}

// ============================================================
// PROJECTS PAGE
// ============================================================

function Projects() {
  const navigate = useNavigate();

  const {
    activeWorkspace,
    workspaceId,
    workspaceRole,
    loading: workspaceLoading,
  } = useWorkspace();

  // ============================================================
  // ACTIVE WORKSPACE CONTEXT
  // ============================================================

  const normalizedWorkspaceRole = String(workspaceRole || "")
    .trim()
    .toUpperCase();

  const normalizedWorkspaceType = String(
    activeWorkspace?.type ||
      activeWorkspace?.workspace_type ||
      activeWorkspace?.workspaceType ||
      "",
  )
    .trim()
    .toUpperCase();

  const isIndividualUser =
    normalizedWorkspaceType === "INDIVIDUAL" &&
    normalizedWorkspaceRole === "USER";

  const isIndividualTeamLeader =
    normalizedWorkspaceType === "INDIVIDUAL" &&
    normalizedWorkspaceRole === "TEAM_LEADER";

  const isWorkspaceUser =
    normalizedWorkspaceRole === "USER" &&
    normalizedWorkspaceType !== "INDIVIDUAL";

  const isTeamLeader = normalizedWorkspaceRole === "TEAM_LEADER";

  // Existing project management permissions.
  const canManageProjects = isTeamLeader;

  // New project creation permissions.
  const canCreateProjects = ["ADMIN", "HR", "TEAM_LEADER"].includes(
    normalizedWorkspaceRole,
  );

  const activeContextKey = workspaceId
    ? `${workspaceId}:${normalizedWorkspaceType}:${normalizedWorkspaceRole}`
    : "";

  // ============================================================
  // STATE
  // ============================================================

  const [projects, setProjects] = useState([]);
  const [memberCounts, setMemberCounts] = useState({});
  const [currentUser, setCurrentUser] = useState(null);

  const [loadedContextKey, setLoadedContextKey] = useState("");

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

  // ============================================================
  // WORKSPACE LOADING GUARD
  // ============================================================

  const contextIsLoaded =
    Boolean(workspaceId) && loadedContextKey === activeContextKey;

  const pageLoading =
    workspaceLoading || loading || (Boolean(workspaceId) && !contextIsLoaded);

  const activeProjects = contextIsLoaded ? projects : [];

  // ============================================================
  // LOAD PROJECT MEMBERSHIP
  // ============================================================

  async function isCurrentUserProjectMember(projectId, userId) {
    if (
      projectId === null ||
      projectId === undefined ||
      projectId === "" ||
      userId === null ||
      userId === undefined
    ) {
      return false;
    }

    try {
      const membersResponse = await apiRequest(
        `/projects/${encodeURIComponent(projectId)}/members`,
      );

      const members = getResponseArray(membersResponse, "members");

      return members.some((member) =>
        sameId(getProjectMemberUserId(member), userId),
      );
    } catch (membershipError) {
      console.warn(
        `Unable to verify membership for project ${projectId}:`,
        membershipError.message,
      );

      return false;
    }
  }

  // ============================================================
  // LOAD PROJECTS FOR THE ACTIVE WORKSPACE AND ROLE
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      if (workspaceLoading) {
        setLoading(true);
        return;
      }

      setLoadedContextKey("");
      setProjects([]);
      setMemberCounts({});
      setCurrentUser(null);
      setError("");

      setEditingProjectId(null);
      setProjectName("");
      setProjectDescription("");

      setLoading(true);

      if (!workspaceId) {
        setError("No active workspace was found.");
        setLoading(false);
        return;
      }

      try {
        let projectRequest;

        if (isIndividualUser) {
          projectRequest = apiRequest(
            `/workspaces/individual/${encodeURIComponent(
              workspaceId,
            )}/my-assigned-projects`,
          );
        } else if (isIndividualTeamLeader) {
          projectRequest = apiRequest(
            `/workspaces/individual/${encodeURIComponent(
              workspaceId,
            )}/projects`,
          );
        } else {
          projectRequest = getProjects();
        }

        const [projectsData, teamsData, userData] = await Promise.all([
          projectRequest,
          getTeams(),
          getCurrentUser(),
        ]);

        if (cancelled) return;

        const loadedProjects = getResponseArray(projectsData, "projects");
        const loadedTeamsRaw = getResponseArray(teamsData, "teams");

        const loadedTeams = loadedTeamsRaw.map((team) => ({
          ...team,
          id: getTeamId(team),
          workspace_id: getTeamWorkspaceId(team),
        }));

        const normalizedProjects = loadedProjects.map((project) => ({
          ...project,
          id: getProjectId(project),
          team_id: getProjectTeamId(project),
          workspace_id: getProjectWorkspaceId(project),
        }));

        const normalizedCurrentUser =
          userData?.user || userData?.data?.user || userData;

        const currentUserId = normalizedCurrentUser?.id;

        // ------------------------------------------------------
        // FIND TEAMS BELONGING TO THE ACTIVE WORKSPACE
        // ------------------------------------------------------

        const workspaceTeams = loadedTeams.filter((team) =>
          sameId(team.workspace_id, workspaceId),
        );

        const workspaceTeamMap = new Map(
          workspaceTeams
            .filter(
              (team) =>
                team.id !== null && team.id !== undefined && team.id !== "",
            )
            .map((team) => [String(team.id), team]),
        );

        // ------------------------------------------------------
        // PROJECT WORKSPACE VALIDATION
        // ------------------------------------------------------

        function projectBelongsToActiveWorkspace(project) {
          const projectWorkspaceId = getProjectWorkspaceId(project);

          if (
            projectWorkspaceId !== null &&
            projectWorkspaceId !== undefined &&
            projectWorkspaceId !== ""
          ) {
            return sameId(projectWorkspaceId, workspaceId);
          }

          const teamId = getProjectTeamId(project);

          if (teamId === null || teamId === undefined || teamId === "") {
            return false;
          }

          const team = workspaceTeamMap.get(String(teamId));

          if (!team) return false;

          return sameId(getTeamWorkspaceId(team), workspaceId);
        }

        // ------------------------------------------------------
        // TEAM LEADER VALIDATION
        // ------------------------------------------------------

        function projectBelongsToCurrentTeamLeader(project) {
          const teamId = getProjectTeamId(project);

          if (teamId === null || teamId === undefined || teamId === "") {
            return false;
          }

          const team = workspaceTeamMap.get(String(teamId));

          if (!team) return false;

          return isTeamUnderLeader(team, currentUserId);
        }

        // ------------------------------------------------------
        // FILTER PROJECTS BY WORKSPACE AND ROLE
        // ------------------------------------------------------

        let visibleProjects = [];

        if (isIndividualUser) {
          visibleProjects = normalizedProjects.filter((project) => {
            const projectWorkspaceId = getProjectWorkspaceId(project);

            if (
              projectWorkspaceId !== null &&
              projectWorkspaceId !== undefined &&
              projectWorkspaceId !== ""
            ) {
              return sameId(projectWorkspaceId, workspaceId);
            }

            return true;
          });
        } else if (isWorkspaceUser) {
          const workspaceProjects = normalizedProjects.filter(
            projectBelongsToActiveWorkspace,
          );

          const membershipResults = await Promise.all(
            workspaceProjects.map(async (project) => ({
              project,
              isMember: await isCurrentUserProjectMember(
                getProjectId(project),
                currentUserId,
              ),
            })),
          );

          if (cancelled) return;

          visibleProjects = membershipResults
            .filter((result) => result.isMember)
            .map((result) => result.project);
        } else if (isIndividualTeamLeader) {
          visibleProjects = normalizedProjects.filter(
            (project) =>
              projectBelongsToActiveWorkspace(project) &&
              projectBelongsToCurrentTeamLeader(project),
          );
        } else {
          const workspaceProjects = normalizedProjects.filter(
            projectBelongsToActiveWorkspace,
          );

          if (isTeamLeader) {
            visibleProjects = workspaceProjects.filter(
              projectBelongsToCurrentTeamLeader,
            );
          } else {
            visibleProjects = workspaceProjects;
          }
        }

        if (cancelled) return;

        setProjects(visibleProjects);
        setCurrentUser(normalizedCurrentUser);

        // ------------------------------------------------------
        // LOAD MEMBER COUNTS
        // ------------------------------------------------------

        const visibleProjectTeamIds = new Set(
          visibleProjects
            .map((project) => getProjectTeamId(project))
            .filter(
              (teamId) =>
                teamId !== null && teamId !== undefined && teamId !== "",
            )
            .map(String),
        );

        const teamsForVisibleProjects = workspaceTeams.filter((team) =>
          visibleProjectTeamIds.has(String(team.id)),
        );

        const counts = {};

        await Promise.all(
          teamsForVisibleProjects.map(async (team) => {
            try {
              const membersData = await getTeamMembers(team.id);
              const members = getResponseArray(membersData, "members");

              counts[team.id] = members.length;
            } catch (memberError) {
              console.warn(
                `Unable to load members for team ${team.id}:`,
                memberError.message,
              );

              counts[team.id] = 0;
            }
          }),
        );

        if (cancelled) return;

        setMemberCounts(counts);
        setLoadedContextKey(activeContextKey);
      } catch (loadError) {
        if (!cancelled) {
          console.error("Projects loading error:", loadError);

          setProjects([]);
          setMemberCounts({});
          setCurrentUser(null);

          setError(
            loadError.message ||
              "Failed to load projects for the selected workspace.",
          );

          setLoadedContextKey(activeContextKey);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, [
    workspaceId,
    workspaceLoading,
    normalizedWorkspaceRole,
    normalizedWorkspaceType,
    isIndividualUser,
    isIndividualTeamLeader,
    isWorkspaceUser,
    isTeamLeader,
    activeContextKey,
  ]);

  // ============================================================
  // EDIT PROJECT
  // ============================================================

  function handleOpenEdit(project) {
    if (!canManageProjects) {
      setError("Only a Team Leader can manage projects from this screen.");
      return;
    }

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

    if (!canManageProjects) {
      setError("You do not have permission to edit projects.");
      return;
    }

    const name = projectName.trim();
    const description = projectDescription.trim();

    if (editingProjectId === null || editingProjectId === undefined) {
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

      const updatedData =
        updatedProject?.project ??
        updatedProject?.data?.project ??
        updatedProject;

      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          sameId(project.id, editingProjectId)
            ? {
                ...project,
                ...updatedData,
              }
            : project,
        ),
      );

      handleCancelEdit();
    } catch (updateError) {
      console.error("Project update error:", updateError);
      setError(updateError.message || "Failed to update project.");
    } finally {
      setUpdatingProjectId(null);
    }
  }

  // ============================================================
  // DELETE PROJECT
  // ============================================================

  async function handleDeleteProject(project) {
    if (!canManageProjects) {
      setError("You do not have permission to delete projects.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${project.name}"?`,
    );

    if (!confirmed) return;

    try {
      setDeletingProjectId(project.id);
      setError("");

      await deleteProject(project.id);

      setProjects((currentProjects) =>
        currentProjects.filter(
          (currentProject) => !sameId(currentProject.id, project.id),
        ),
      );

      if (sameId(editingProjectId, project.id)) {
        handleCancelEdit();
      }
    } catch (deleteError) {
      console.error("Project deletion error:", deleteError);
      setError(deleteError.message || "Failed to delete project.");
    } finally {
      setDeletingProjectId(null);
    }
  }

  // ============================================================
  // PROJECT HELPERS
  // ============================================================

  function isProjectCreator(project) {
    if (
      currentUser?.id === null ||
      currentUser?.id === undefined ||
      project?.created_by === null ||
      project?.created_by === undefined
    ) {
      return false;
    }

    return sameId(project.created_by, currentUser.id);
  }

  // ============================================================
  // SEARCH, FILTER AND SORT
  // ============================================================

  const filteredProjects = useMemo(() => {
    let result = [...activeProjects];

    const search = searchTerm.trim().toLowerCase();

    if (search) {
      result = result.filter((project) => {
        const name = String(project.name || "").toLowerCase();
        const description = String(project.description || "").toLowerCase();

        return name.includes(search) || description.includes(search);
      });
    }

    if (activeFilter === "Planning" || activeFilter === "Completed") {
      result = [];
    }

    result.sort((first, second) => {
      if (sortOrder === "newest") {
        return Number(second.id) - Number(first.id);
      }

      if (sortOrder === "oldest") {
        return Number(first.id) - Number(second.id);
      }

      return String(first.name || "").localeCompare(String(second.name || ""));
    });

    return result;
  }, [activeProjects, searchTerm, activeFilter, sortOrder]);

  // ============================================================
  // PROJECT SUMMARY
  // ============================================================

  const totalCollaborators = activeProjects.reduce((total, project) => {
    const teamId = getProjectTeamId(project);
    const count = memberCounts[teamId] ?? memberCounts[String(teamId)] ?? 0;

    return total + count;
  }, 0);

  const featuredProject =
    filteredProjects.length > 0 ? filteredProjects[0] : null;

  const secondaryProjects =
    filteredProjects.length > 1 ? filteredProjects.slice(1) : [];

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="zyra-projects">
      <div className="projects-background-grid" />
      <div className="projects-background-glow projects-glow-one" />
      <div className="projects-background-glow projects-glow-two" />

      {/* Back */}
      <button
        type="button"
        className="back-page-btn"
        onClick={() => {
          if (normalizedWorkspaceType === "INDIVIDUAL") {
            navigate(
              normalizedWorkspaceRole === "USER"
                ? "/dashboard/individual/user"
                : "/dashboard/individual/team-leader",
            );
            return;
          }

          const companyDashboardPaths = {
            ADMIN: "/dashboard/company/admin",
            HR: "/dashboard/company/hr",
            TEAM_LEADER: "/dashboard/company/team-leader",
            USER: "/dashboard/company/user",
          };

          navigate(
            companyDashboardPaths[normalizedWorkspaceRole] || "/dashboard",
          );
        }}
      >
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
                {isIndividualUser
                  ? "View projects assigned to you and track your progress"
                  : `Projects for ${
                      activeWorkspace?.name || "your active workspace"
                    }`}
              </p>
            </div>
          </div>
        </div>

        {/* CREATE PROJECT BUTTON */}
        {canCreateProjects && (
          <button
            type="button"
            className="projects-create-btn"
            onClick={() => navigate("/projects/create")}
          >
            <Plus size={17} />
            Create Project
          </button>
        )}
      </div>

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      {/* Statistics */}
      <div className="projects-summary">
        <div className="project-summary-card">
          <div className="project-summary-icon">
            <FolderKanban size={19} />
          </div>

          <div className="project-summary-content">
            <strong>
              {pageLoading
                ? "..."
                : String(activeProjects.length).padStart(2, "0")}
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
              {pageLoading
                ? "..."
                : String(totalCollaborators).padStart(2, "0")}
            </strong>

            <span>Collaborators</span>
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
              type="button"
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
            type="button"
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
              type="button"
              className={
                viewMode === "grid"
                  ? "view-toggle-btn active"
                  : "view-toggle-btn"
              }
              onClick={() => setViewMode("grid")}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid size={15} />
            </button>

            <button
              type="button"
              className={
                viewMode === "list"
                  ? "view-toggle-btn active"
                  : "view-toggle-btn"
              }
              onClick={() => setViewMode("list")}
              title="List view"
              aria-label="List view"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Projects */}
      <section className="projects-panel">
        {pageLoading ? (
          <div className="dashboard-empty">
            <FolderKanban size={30} />

            <h4>Loading projects...</h4>

            <p>
              {isIndividualUser
                ? "Finding the projects assigned to your account."
                : `Loading projects for ${
                    activeWorkspace?.name || "your workspace"
                  }.`}
            </p>
          </div>
        ) : activeProjects.length === 0 ? (
          <div className="dashboard-empty">
            <FolderKanban size={30} />

            <h4>
              {isIndividualUser
                ? "No assigned projects yet"
                : "No projects in this workspace"}
            </h4>

            <p>
              {isIndividualUser
                ? "Projects assigned to you through an accepted invitation will appear here."
                : isWorkspaceUser
                  ? "Projects you belong to in this workspace will appear here."
                  : isTeamLeader
                    ? "Projects belonging to teams under you will appear here when available."
                    : "Projects belonging to the selected workspace will appear here when available to your account."}
            </p>

            {/* CREATE PROJECT BUTTON FOR EMPTY STATE */}
            {canCreateProjects && (
              <button
                type="button"
                className="empty-action"
                onClick={() => navigate("/projects/create")}
              >
                <Plus size={16} />
                Create Project
              </button>
            )}
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
                        {memberCounts[getProjectTeamId(featuredProject)] ||
                          0}{" "}
                        Members
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
                  type="button"
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
                  const teamMemberCount =
                    memberCounts[getProjectTeamId(project)] || 0;

                  const isCreator = isProjectCreator(project);

                  const isUpdating = sameId(updatingProjectId, project.id);

                  const isDeleting = sameId(deletingProjectId, project.id);

                  const isEditing = sameId(editingProjectId, project.id);

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
                              type="button"
                              className="project-open-btn"
                              onClick={() =>
                                navigate(`/projects/${project.id}`)
                              }
                            >
                              Open Project
                            </button>

                            {canManageProjects && isCreator && (
                              <>
                                <button
                                  type="button"
                                  className="project-edit-btn"
                                  onClick={() => handleOpenEdit(project)}
                                  disabled={isDeleting}
                                  title="Edit project"
                                >
                                  <Pencil size={15} />
                                </button>

                                <button
                                  type="button"
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
