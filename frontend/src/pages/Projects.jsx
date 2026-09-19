import {
  FolderKanban,
  Plus,
  ArrowLeft,
  CalendarDays,
  Users,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { getProjects } from "../services/ProjectService";
import { getTeams, getTeamMembers } from "../services/teamService";

function Projects() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [memberCounts, setMemberCounts] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProjects() {
      try {
        setLoading(true);
        setError("");

        const [projectsData, teamsData] = await Promise.all([
          getProjects(),
          getTeams(),
        ]);

        const loadedProjects = Array.isArray(projectsData) ? projectsData : [];

        const loadedTeams = Array.isArray(teamsData) ? teamsData : [];

        setProjects(loadedProjects);

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

              return (
                <div className="project-card" key={project.id}>
                  <div className="project-card-main">
                    <div className="project-card-icon">
                      <FolderKanban size={22} />
                    </div>

                    <div className="project-card-info">
                      <h3>{project.name}</h3>

                      <p>{project.description || "No description provided."}</p>

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

                  <button
                    className="project-open-btn"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    Open Project
                    <ArrowLeft size={15} />
                  </button>
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
