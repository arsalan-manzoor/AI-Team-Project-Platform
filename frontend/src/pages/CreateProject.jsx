import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Users,
  CheckSquare,
  Flag,
  FileText,
  Plus,
  CalendarDays,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../styles/create-project.css";

import { createProject } from "../services/ProjectService";
import { getTeams } from "../services/teamService";

function CreateProject() {
  const navigate = useNavigate();

  const [project, setProject] = useState({
    name: "",
    description: "",
    teamId: "",
  });

  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTeams() {
      try {
        const teamsData = await getTeams();

        const loadedTeams = Array.isArray(teamsData) ? teamsData : [];

        setTeams(loadedTeams);
      } catch (error) {
        console.error("Failed to load teams:", error);
        setError(error.message || "Failed to load teams.");
      } finally {
        setLoadingTeams(false);
      }
    }

    loadTeams();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!project.teamId) {
      setError("Please select a team.");
      return;
    }

    try {
      setLoading(true);

      await createProject({
        name: project.name.trim(),
        description: project.description.trim(),
        teamId: Number(project.teamId),
      });

      alert("Project created successfully!");

      navigate("/projects");
    } catch (error) {
      console.error("Project creation error:", error);
      setError(error.message || "Failed to create project.");
    } finally {
      setLoading(false);
    }
  }

  const selectedTeam = teams.find(
    (team) => String(team.id) === String(project.teamId)
  );

  const projectName =
    project.name.trim() || "Your Project Name";

  const projectDescription =
    project.description.trim() ||
    "Your project description will appear here.";

  return (
    <div className="zyra-create-page">

      {/* =====================================================
          SUBTLE BACKGROUND ANIMATION
          ===================================================== */}

      <div className="create-project-background" aria-hidden="true">
        <div className="create-bg-orb create-bg-orb-one"></div>
        <div className="create-bg-orb create-bg-orb-two"></div>
        <div className="create-bg-orb create-bg-orb-three"></div>
      </div>

      {/* =====================================================
          TOP NAVIGATION
          ===================================================== */}

      <div className="create-project-topbar">
        <button
          className="create-back-button"
          onClick={() => navigate("/projects")}
          disabled={loading}
        >
          <ArrowLeft size={15} />
          <span>Back to Projects</span>
        </button>

        <div className="create-breadcrumb">
          <span>Projects</span>
          <span className="breadcrumb-separator">›</span>
          <span>New</span>
        </div>
      </div>

      {/* =====================================================
          MAIN CREATE PROJECT LAYOUT
          ===================================================== */}

      <div className="create-project-layout">

        {/* ===================================================
            LEFT SIDE
            =================================================== */}

        <div className="create-project-content">

          <div className="create-project-heading">
            <span className="create-project-label">
              PROJECT WORKSPACE
            </span>

            <h1>What are we building?</h1>

            <p>
              Set up your project and define what your team wants to achieve.
            </p>
          </div>

          <form
            className="create-project-form"
            onSubmit={handleSubmit}
          >

            {/* Project Name */}

            <div className="create-field">
              <label htmlFor="project-name">
                Project name
              </label>

              <input
                id="project-name"
                type="text"
                placeholder="e.g., Acme Platform Launch"
                value={project.name}
                onChange={(event) =>
                  setProject({
                    ...project,
                    name: event.target.value,
                  })
                }
                required
                disabled={loading}
              />
            </div>

            {/* Description */}

            <div className="create-field">
              <label htmlFor="project-description">
                Project description
              </label>

              <div className="description-wrapper">

                <div className="description-toolbar">
                  <button type="button" tabIndex="-1">
                    B
                  </button>

                  <button type="button" tabIndex="-1">
                    <span className="italic-icon">I</span>
                  </button>

                  <button type="button" tabIndex="-1">
                    <span className="underline-icon">U</span>
                  </button>

                  <span className="toolbar-divider"></span>

                  <button type="button" tabIndex="-1">
                    •
                  </button>

                  <button type="button" tabIndex="-1">
                    ≡
                  </button>

                  <button type="button" tabIndex="-1">
                    ↗
                  </button>
                </div>

                <textarea
                  id="project-description"
                  placeholder="e.g., Describe the goals, scope, and objectives of the project..."
                  rows="6"
                  value={project.description}
                  onChange={(event) =>
                    setProject({
                      ...project,
                      description: event.target.value,
                    })
                  }
                  required
                  disabled={loading}
                ></textarea>

              </div>
            </div>

            {/* Team */}

            <div className="create-field">
              <label htmlFor="project-team">
                Team
              </label>

              <div className="team-select-wrapper">

                <div className="team-select-icon">
                  <Users size={15} />
                </div>

                <select
                  id="project-team"
                  value={project.teamId}
                  onChange={(event) =>
                    setProject({
                      ...project,
                      teamId: event.target.value,
                    })
                  }
                  required
                  disabled={loading || loadingTeams}
                >
                  {loadingTeams ? (
                    <option value="">
                      Loading teams...
                    </option>
                  ) : teams.length === 0 ? (
                    <option value="">
                      No teams available
                    </option>
                  ) : (
                    <>
                      <option value="">
                        Select a team...
                      </option>

                      {teams.map((team) => (
                        <option
                          key={team.id}
                          value={team.id}
                        >
                          {team.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>

              </div>
            </div>

            {/* Error */}

            {error && (
              <p className="create-project-error">
                {error}
              </p>
            )}

            {/* Actions */}

            <div className="create-project-actions">

              <button
                type="submit"
                className="create-project-submit"
                disabled={
                  loading ||
                  loadingTeams ||
                  teams.length === 0
                }
              >
                {loading ? (
                  <>
                    <span className="button-spinner"></span>
                    Creating...
                  </>
                ) : (
                  "Create project"
                )}
              </button>

              <button
                type="button"
                className="create-project-cancel"
                onClick={() => navigate("/projects")}
                disabled={loading}
              >
                Cancel
              </button>

            </div>

          </form>
        </div>

        {/* ===================================================
            RIGHT SIDE — PROJECT PREVIEW
            =================================================== */}

        <aside className="project-preview">

          <div className="preview-header">
            <span>Project Preview</span>

            <span className="preview-status">
              DRAFT
            </span>
          </div>

          <div className="preview-project-name">
            {projectName}

            <span className="draft-label">
              (Draft)
            </span>
          </div>

          <p className="preview-description">
            {projectDescription}
          </p>

          {/* Stats */}

          <div className="preview-stats">

            {/* Team */}

            <div className="preview-stat-card active">

              <div className="preview-stat-top">
                <div className="preview-stat-icon">
                  <Users size={17} />
                </div>

                <strong>
                  {selectedTeam ? selectedTeam.name : "1 Team"}
                </strong>
              </div>

              <span className="preview-stat-label">
                {selectedTeam
                  ? "Selected team"
                  : "Team"}
              </span>

              <div className="preview-team-members">
                <span className="member-avatar">
                  {selectedTeam?.name?.charAt(0)?.toUpperCase() || "T"}
                </span>

                <span className="member-avatar member-avatar-two">
                  +
                </span>
              </div>

            </div>

            {/* Tasks */}

            <div className="preview-stat-card">

              <div className="preview-stat-top">
                <div className="preview-stat-icon">
                  <CheckSquare size={17} />
                </div>

                <strong>0 Tasks</strong>
              </div>

              <span className="preview-stat-label">
                Active 0 &nbsp;&nbsp; Completed 0
              </span>

              <button
                type="button"
                className="preview-small-button"
              >
                <Plus size={13} />
                Create task
              </button>

            </div>

            {/* Milestones */}

            <div className="preview-stat-card">

              <div className="preview-stat-top">
                <div className="preview-stat-icon">
                  <Flag size={17} />
                </div>

                <strong>0 Milestones</strong>
              </div>

              <div className="preview-mini-stats">
                <span>
                  Upcoming
                  <b>0</b>
                </span>

                <span>
                  Overdue
                  <b>0</b>
                </span>
              </div>

            </div>

            {/* Resources */}

            <div className="preview-stat-card">

              <div className="preview-stat-top">
                <div className="preview-stat-icon">
                  <FileText size={17} />
                </div>

                <strong>0 Resources</strong>
              </div>

              <div className="preview-mini-stats">
                <span>
                  Docs
                  <b>0</b>
                </span>

                <span>
                  Links
                  <b>0</b>
                </span>
              </div>

            </div>

          </div>

          {/* =================================================
              TIMELINE
              ================================================= */}

          <div className="preview-timeline">

            <div className="timeline-header">

              <div>
                <CalendarDays size={14} />

                <span>Timeline</span>
              </div>

              <span className="timeline-menu">
                •••
              </span>

            </div>

            <div className="timeline-dates">
              <span>Sept 2026</span>
              <span>Oct 2026</span>
              <span>Nov 2026</span>
              <span>Dec 2026</span>
              <span>Jan 2027</span>
            </div>

            <div className="timeline-track">

              <div className="timeline-line"></div>

              <div className="timeline-progress"></div>

              <span className="timeline-dot dot-one"></span>
              <span className="timeline-dot dot-two"></span>
              <span className="timeline-dot dot-three"></span>

            </div>

            <div className="timeline-footer">
              <span>Roadmap</span>
              <span>Jun 2026</span>
            </div>

          </div>

        </aside>

      </div>
    </div>
  );
}

export default CreateProject;