import { Users, UserPlus, FolderKanban } from "lucide-react";
import { useNavigate } from "react-router-dom";

function Teams() {
  const navigate = useNavigate();

  return (
    <div className="zyra-teams">
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
        >
          <UserPlus size={17} />
          Create Team
        </button>
      </div>

      <div className="teams-summary">
        <div className="team-summary-card">
          <div className="team-summary-icon">
            <Users size={19} />
          </div>
          <div>
            <span>Total Teams</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="team-summary-card">
          <div className="team-summary-icon">
            <UserPlus size={19} />
          </div>
          <div>
            <span>Team Members</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="team-summary-card">
          <div className="team-summary-icon">
            <FolderKanban size={19} />
          </div>
          <div>
            <span>Team Projects</span>
            <strong>0</strong>
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
      </section>
    </div>
  );
}

export default Teams;
