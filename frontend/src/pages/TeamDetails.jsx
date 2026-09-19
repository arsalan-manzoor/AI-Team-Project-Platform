import { Users, ArrowLeft, UserPlus, FolderKanban } from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getTeamById, getTeamMembers } from "../services/teamService";

function TeamDetails() {
  const navigate = useNavigate();
  const { teamId } = useParams();

  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTeamDetails() {
      try {
        setLoading(true);
        setError("");

        const teamData = await getTeamById(teamId);
        const membersData = await getTeamMembers(teamId);

        setTeam(teamData);
        setMembers(Array.isArray(membersData) ? membersData : []);
      } catch (error) {
        console.error("Team details loading error:", error);

        setError(error.message || "Failed to load team details.");
      } finally {
        setLoading(false);
      }
    }

    if (teamId) {
      loadTeamDetails();
    }
  }, [teamId]);

  return (
    <div className="zyra-teams">
      <button className="back-page-btn" onClick={() => navigate("/teams")}>
        <ArrowLeft size={15} />
        Back to Teams
      </button>

      {error && <div className="dashboard-error">{error}</div>}

      {loading ? (
        <div className="teams-empty">
          <div className="teams-empty-icon">
            <Users size={28} />
          </div>

          <h3>Loading team...</h3>

          <p>Getting team information from the ZYRA workspace.</p>
        </div>
      ) : !team ? (
        <div className="teams-empty">
          <div className="teams-empty-icon">
            <Users size={28} />
          </div>

          <h3>Team not found</h3>

          <p>The requested team could not be found.</p>
        </div>
      ) : (
        <>
          <div className="teams-header">
            <div>
              <p className="teams-eyebrow">TEAM WORKSPACE</p>

              <h2>{team.name}</h2>

              <p className="teams-subtitle">
                {team.description || "Manage your team and collaborators."}
              </p>
            </div>

            <button className="teams-create-btn" type="button">
              <UserPlus size={17} />
              Add Member
            </button>
          </div>

          <div className="teams-summary">
            <div className="team-summary-card">
              <div className="team-summary-icon">
                <Users size={19} />
              </div>

              <div>
                <span>Team Members</span>

                <strong>{members.length}</strong>
              </div>
            </div>

            <div className="team-summary-card">
              <div className="team-summary-icon">
                <FolderKanban size={19} />
              </div>

              <div>
                <span>Team ID</span>

                <strong>{teamId}</strong>
              </div>
            </div>
          </div>

          <section className="teams-panel">
            <div className="teams-panel-header">
              <div>
                <h3>Team Members</h3>

                <p>People currently working in this team.</p>
              </div>
            </div>

            {members.length === 0 ? (
              <div className="teams-empty">
                <div className="teams-empty-icon">
                  <Users size={28} />
                </div>

                <h3>No members yet</h3>

                <p>Add members to start collaborating on this team.</p>
              </div>
            ) : (
              <div className="team-list">
                {members.map((member) => (
                  <div className="team-card" key={member.id}>
                    <div className="team-card-main">
                      <div className="team-card-icon">
                        <Users size={22} />
                      </div>

                      <div>
                        <h3>
                          {member.name || member.email || `User ${member.id}`}
                        </h3>

                        <p>{member.email || "Team member"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default TeamDetails;
