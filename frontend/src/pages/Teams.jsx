import {
  Users,
  UserPlus,
  FolderKanban,
  ArrowLeft,
  ArrowRight,
  Trash2,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { getTeams, getTeamMembers, deleteTeam } from "../services/teamService";
import { getProjects } from "../services/ProjectService";

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

  return (
    <div className="zyra-teams">
      <button
        className="back-page-btn"
        onClick={() => navigate("/dashboard")}
        disabled={deletingTeamId !== null}
      >
        <ArrowLeft size={15} />
        Back to Dashboard
      </button>

      <div className="teams-header">
        <div>
          <p className="teams-eyebrow">TEAM WORKSPACE</p>

          <h2>Teams</h2>

          <p className="teams-subtitle">
            Organize your collaborators and work together across projects.
          </p>
        </div>

        <button
          className="teams-create-btn"
          onClick={() => navigate("/teams/create")}
          disabled={deletingTeamId !== null}
        >
          <UserPlus size={17} />
          Create Team
        </button>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      <div className="teams-summary">
        <div className="team-summary-card">
          <div className="team-summary-icon">
            <Users size={19} />
          </div>

          <div>
            <span>Total Teams</span>

            <strong>{loading ? "..." : totalTeams}</strong>
          </div>
        </div>

        <div className="team-summary-card">
          <div className="team-summary-icon">
            <UserPlus size={19} />
          </div>

          <div>
            <span>Team Members</span>

            <strong>{loading ? "..." : totalMembers}</strong>
          </div>
        </div>

        <div className="team-summary-card">
          <div className="team-summary-icon">
            <FolderKanban size={19} />
          </div>

          <div>
            <span>Team Projects</span>

            <strong>{loading ? "..." : totalProjects}</strong>
          </div>
        </div>
      </div>

      <section className="teams-panel">
        <div className="teams-panel-header">
          <div>
            <h3>Your Teams</h3>

            <p>Teams you are currently a member of</p>
          </div>
        </div>

        {loading ? (
          <div className="teams-empty">
            <div className="teams-empty-icon">
              <Users size={28} />
            </div>

            <h3>Loading teams...</h3>

            <p>Getting your teams from the ZYRA workspace.</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="teams-empty">
            <div className="teams-empty-icon">
              <Users size={28} />
            </div>

            <h3>No teams yet</h3>

            <p>
              Create your first team and start collaborating with your project
              members in ZYRA.
            </p>

            <button
              className="teams-empty-btn"
              onClick={() => navigate("/teams/create")}
            >
              <UserPlus size={16} />
              Create Your First Team
            </button>
          </div>
        ) : (
          <div className="team-list">
            {teams.map((team) => {
              const teamProjects = projects.filter(
                (project) => project.team_id === team.id,
              );

              const isDeleting = deletingTeamId === team.id;

              return (
                <div className="team-card" key={team.id}>
                  <div className="team-card-main">
                    <div className="team-card-icon">
                      <Users size={22} />
                    </div>

                    <div>
                      <h3>{team.name}</h3>

                      <p>{team.description || "No description provided."}</p>
                    </div>
                  </div>

                  <div className="team-card-meta">
                    <span>{memberCounts[team.id] || 0} Members</span>

                    <span>{teamProjects.length} Projects</span>

                    <button
                      type="button"
                      className="team-view-btn"
                      onClick={() => navigate(`/teams/${team.id}`)}
                      disabled={isDeleting}
                    >
                      View Team
                      <ArrowRight size={15} />
                    </button>

                    <button
                      type="button"
                      className="team-view-btn"
                      onClick={() => handleDeleteTeam(team)}
                      disabled={isDeleting}
                      title="Delete team"
                    >
                      <Trash2 size={15} />

                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Teams;
