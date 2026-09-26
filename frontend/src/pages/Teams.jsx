import {
  Users,
  UserPlus,
  FolderKanban,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Activity,
  MoreHorizontal,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { getTeams, getTeamMembers, deleteTeam } from "../services/teamService";

import { getProjects } from "../services/ProjectService";

import "../styles/teams.css";

function Teams() {
  const navigate = useNavigate();

  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [memberCounts, setMemberCounts] = useState({});

  const [loading, setLoading] = useState(true);
  const [deletingTeamId, setDeletingTeamId] = useState(null);
  const [error, setError] = useState("");

  async function loadTeams() {
    try {
      setLoading(true);
      setError("");

      const [teamsData, projectsData] = await Promise.all([
        getTeams(),
        getProjects(),
      ]);

      const loadedTeams = Array.isArray(teamsData) ? teamsData : [];

      const loadedProjects = Array.isArray(projectsData) ? projectsData : [];

      setTeams(loadedTeams);
      setProjects(loadedProjects);

      const counts = {};

      await Promise.all(
        loadedTeams.map(async (team) => {
          try {
            const members = await getTeamMembers(team.id);

            counts[team.id] = Array.isArray(members) ? members.length : 0;
          } catch {
            counts[team.id] = 0;
          }
        }),
      );

      setMemberCounts(counts);
    } catch (error) {
      console.error("Teams loading error:", error);

      setError(error.message || "Failed to load teams.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeams();
  }, []);

  async function handleDeleteTeam(team) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${team.name}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingTeamId(team.id);
      setError("");

      await deleteTeam(team.id);

      setTeams((currentTeams) =>
        currentTeams.filter((currentTeam) => currentTeam.id !== team.id),
      );

      setMemberCounts((currentCounts) => {
        const updatedCounts = { ...currentCounts };

        delete updatedCounts[team.id];

        return updatedCounts;
      });
    } catch (error) {
      console.error("Team deletion error:", error);

      setError(error.message || "Failed to delete team.");
    } finally {
      setDeletingTeamId(null);
    }
  }

  const totalTeams = teams.length;

  const totalMembers = Object.values(memberCounts).reduce(
    (total, count) => total + count,
    0,
  );

  const totalProjects = projects.length;

  const averageMembers =
    totalTeams > 0 ? (totalMembers / totalTeams).toFixed(1) : "0";

  function getTeamProjects(teamId) {
    return projects.filter((project) => project.team_id === teamId);
  }

  function getTeamInitials(name) {
    if (!name) {
      return "TM";
    }

    const words = name.trim().split(/\s+/);

    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return (
    <div className="zyra-teams">
      {/* =====================================================
          BACKGROUND
          ===================================================== */}

      <div className="teams-background-grid" />
      <div className="teams-background-glow teams-glow-one" />
      <div className="teams-background-glow teams-glow-two" />

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="teams-topbar">
        <button
          type="button"
          className="back-page-btn"
          onClick={() => navigate("/dashboard")}
          disabled={deletingTeamId !== null}
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </button>

        <div className="teams-workspace-status">
          <span className="teams-status-dot" />
          WORKSPACE ACTIVE
        </div>
      </div>

      <header className="teams-header">
        <div className="teams-header-content">
          <p className="teams-eyebrow">ZYRA / COLLABORATION</p>

          <div className="teams-title-row">
            <h2>Teams</h2>

            <span className="teams-title-divider" />

            <div className="teams-title-context">
              <strong>Team Workspace</strong>
              <span>Connect, collaborate and build together</span>
            </div>
          </div>

          <p className="teams-subtitle">
            Organize your collaborators and work together across projects.
          </p>
        </div>

        <button
          type="button"
          className="teams-create-btn"
          onClick={() => navigate("/teams/create")}
          disabled={deletingTeamId !== null}
        >
          <UserPlus size={16} />
          Create Team
          <span className="create-btn-plus">+</span>
        </button>
      </header>

      {error && <div className="dashboard-error">{error}</div>}

      {/* =====================================================
          SUMMARY
          ===================================================== */}

      <section className="teams-summary">
        <div className="team-summary-card">
          <div className="team-summary-label">TOTAL TEAMS</div>

          <div className="team-summary-value">
            {loading ? "..." : totalTeams}
          </div>

          <div className="team-summary-icon">
            <Users size={16} />
          </div>
        </div>

        <div className="team-summary-card">
          <div className="team-summary-label">TEAM MEMBERS</div>

          <div className="team-summary-value">
            {loading ? "..." : totalMembers}
          </div>

          <div className="team-summary-icon">
            <UserPlus size={16} />
          </div>
        </div>

        <div className="team-summary-card">
          <div className="team-summary-label">TEAM PROJECTS</div>

          <div className="team-summary-value">
            {loading ? "..." : totalProjects}
          </div>

          <div className="team-summary-icon">
            <FolderKanban size={16} />
          </div>
        </div>

        <div className="team-summary-card">
          <div className="team-summary-label">AVG. MEMBERS / TEAM</div>

          <div className="team-summary-value">
            {loading ? "..." : averageMembers}
          </div>

          <div className="team-summary-icon">
            <Activity size={16} />
          </div>
        </div>
      </section>

      {/* =====================================================
          TEAMS SECTION
          ===================================================== */}

      <section className="teams-panel">
        <div className="teams-panel-header">
          <div>
            <span className="teams-section-label">
              <span className="section-live-dot" />
              YOUR TEAMS
            </span>

            <h3>Collaboration Hub</h3>

            <p>Teams you are currently a member of</p>
          </div>

          <div className="teams-panel-count">
            {loading ? "..." : `${totalTeams} TEAMS`}
          </div>
        </div>

        {loading ? (
          <div className="teams-empty">
            <div className="teams-empty-icon">
              <Users size={27} />
            </div>

            <h3>Loading teams...</h3>

            <p>Getting your teams from the ZYRA workspace.</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="teams-empty">
            <div className="teams-empty-icon">
              <Users size={27} />
            </div>

            <h3>No teams yet</h3>

            <p>
              Create your first team and start collaborating with your project
              members in ZYRA.
            </p>

            <button
              type="button"
              className="teams-empty-btn"
              onClick={() => navigate("/teams/create")}
            >
              <UserPlus size={16} />
              Create Your First Team
            </button>
          </div>
        ) : (
          <div className="team-list">
            {teams.map((team, index) => {
              const teamProjects = getTeamProjects(team.id);

              const memberCount = memberCounts[team.id] || 0;

              const isDeleting = deletingTeamId === team.id;

              const initials = getTeamInitials(team.name);

              return (
                <article
                  className="team-card"
                  key={team.id}
                  style={{
                    "--team-index": index,
                  }}
                >
                  {/* Top row */}

                  <div className="team-card-top">
                    <div className="team-card-icon">
                      <span>{initials}</span>
                    </div>

                    <button
                      type="button"
                      className="team-card-menu"
                      onClick={() => handleDeleteTeam(team)}
                      disabled={isDeleting}
                      title="Delete team"
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  </div>

                  {/* Team identity */}

                  <div className="team-card-content">
                    <span className="team-card-code">TEAM #{team.id}</span>

                    <h3>{team.name}</h3>

                    <p>{team.description || "No description provided."}</p>
                  </div>

                  {/* Team metrics */}

                  <div className="team-card-metrics">
                    <div className="team-card-metric">
                      <strong>{memberCount}</strong>

                      <span>MEMBERS</span>
                    </div>

                    <div className="team-card-metric-divider" />

                    <div className="team-card-metric">
                      <strong>{teamProjects.length}</strong>

                      <span>PROJECTS</span>
                    </div>
                  </div>

                  {/* Member visual */}

                  <div className="team-card-members">
                    <div className="team-member-stack">
                      {Array.from({
                        length: Math.min(memberCount, 4),
                      }).map((_, memberIndex) => (
                        <span className="team-member-avatar" key={memberIndex}>
                          <Users size={11} />
                        </span>
                      ))}

                      {memberCount > 4 && (
                        <span className="team-member-more">
                          +{memberCount - 4}
                        </span>
                      )}

                      {memberCount === 0 && (
                        <span className="team-no-members">No members</span>
                      )}
                    </div>
                  </div>

                  {/* Bottom */}

                  <div className="team-card-footer">
                    <div className="team-card-activity">
                      <span className="activity-dot" />
                      <span>
                        {memberCount > 0 ? "Team active" : "Awaiting members"}
                      </span>
                    </div>

                    <div className="team-card-actions">
                      <button
                        type="button"
                        className="team-view-btn"
                        onClick={() => navigate(`/teams/${team.id}`)}
                        disabled={isDeleting}
                      >
                        View Team
                        <ArrowRight size={14} />
                      </button>

                      <button
                        type="button"
                        className="team-delete-btn"
                        onClick={() => handleDeleteTeam(team)}
                        disabled={isDeleting}
                        title="Delete team"
                      >
                        <Trash2 size={14} />

                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Teams;
