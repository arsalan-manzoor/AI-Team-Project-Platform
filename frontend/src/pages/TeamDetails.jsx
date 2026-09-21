import {
  Users,
  ArrowLeft,
  UserPlus,
  FolderKanban,
  Pencil,
  X,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getTeamById,
  getTeamMembers,
  addTeamMember,
  updateTeam,
} from "../services/teamService";

function TeamDetails() {
  const navigate = useNavigate();
  const { teamId } = useParams();

  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);

  const [showAddMember, setShowAddMember] = useState(false);
  const [userId, setUserId] = useState("");

  const [showEditTeam, setShowEditTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [addingMember, setAddingMember] = useState(false);
  const [updatingTeam, setUpdatingTeam] = useState(false);

  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [teamEditError, setTeamEditError] = useState("");

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

  useEffect(() => {
    if (teamId) {
      loadTeamDetails();
    }
  }, [teamId]);

  function handleOpenEditTeam() {
    setTeamEditError("");
    setTeamName(team?.name || "");
    setTeamDescription(team?.description || "");
    setShowEditTeam(true);
  }

  function handleCancelEditTeam() {
    setShowEditTeam(false);
    setTeamName("");
    setTeamDescription("");
    setTeamEditError("");
  }

  async function handleUpdateTeam(event) {
    event.preventDefault();

    setTeamEditError("");

    const name = teamName.trim();
    const description = teamDescription.trim();

    if (!name) {
      setTeamEditError("Please enter a team name.");
      return;
    }

    try {
      setUpdatingTeam(true);

      const updatedTeam = await updateTeam(teamId, {
        name,
        description,
      });

      setTeam(updatedTeam);
      setShowEditTeam(false);

      setTeamName("");
      setTeamDescription("");
    } catch (error) {
      console.error("Team update error:", error);

      setTeamEditError(error.message || "Failed to update team.");
    } finally {
      setUpdatingTeam(false);
    }
  }

  async function handleAddMember(event) {
    event.preventDefault();

    setMemberError("");

    const trimmedUserId = userId.trim();

    if (!trimmedUserId) {
      setMemberError("Please enter a user ID.");
      return;
    }

    if (!Number.isInteger(Number(trimmedUserId))) {
      setMemberError("User ID must be a number.");
      return;
    }

    try {
      setAddingMember(true);

      await addTeamMember(teamId, Number(trimmedUserId));

      setUserId("");
      setShowAddMember(false);

      await loadTeamDetails();
    } catch (error) {
      console.error("Add member error:", error);

      setMemberError(error.message || "Failed to add member.");
    } finally {
      setAddingMember(false);
    }
  }

  return (
    <div className="zyra-teams">
      <button
        className="back-page-btn"
        onClick={() => navigate("/teams")}
        disabled={addingMember || updatingTeam}
      >
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

            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                className="teams-create-btn"
                type="button"
                onClick={handleOpenEditTeam}
                disabled={addingMember || updatingTeam}
              >
                <Pencil size={17} />
                Edit Team
              </button>

              <button
                className="teams-create-btn"
                type="button"
                onClick={() => {
                  setShowAddMember((current) => !current);
                  setMemberError("");
                }}
                disabled={addingMember || updatingTeam}
              >
                <UserPlus size={17} />
                {showAddMember ? "Cancel" : "Add Member"}
              </button>
            </div>
          </div>

          {showEditTeam && (
            <form
              className="zyra-create-form"
              onSubmit={handleUpdateTeam}
              style={{ marginBottom: "24px" }}
            >
              <div className="form-section">
                <div className="form-section-header">
                  <h3>Edit Team</h3>

                  <p>Update the name and description of this team.</p>
                </div>

                <div className="form-group">
                  <label>Team Name</label>

                  <input
                    type="text"
                    placeholder="Enter team name"
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    disabled={updatingTeam}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>

                  <textarea
                    placeholder="Enter team description"
                    value={teamDescription}
                    onChange={(event) => setTeamDescription(event.target.value)}
                    disabled={updatingTeam}
                    rows="4"
                  />
                </div>

                {teamEditError && (
                  <p className="login-error">{teamEditError}</p>
                )}

                <div className="create-form-actions">
                  <button
                    type="button"
                    className="cancel-form-btn"
                    onClick={handleCancelEditTeam}
                    disabled={updatingTeam}
                  >
                    <X size={16} />
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="submit-project-btn"
                    disabled={updatingTeam}
                  >
                    <Pencil size={16} />
                    {updatingTeam ? "Updating..." : "Update Team"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {showAddMember && (
            <form
              className="zyra-create-form"
              onSubmit={handleAddMember}
              style={{ marginBottom: "24px" }}
            >
              <div className="form-section">
                <div className="form-section-header">
                  <h3>Add Team Member</h3>

                  <p>
                    Enter the user ID of an existing ZYRA user to add them to
                    this team.
                  </p>
                </div>

                <div className="form-group">
                  <label>User ID</label>

                  <input
                    type="number"
                    min="1"
                    placeholder="Enter user ID"
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    disabled={addingMember}
                    required
                  />
                </div>

                {memberError && <p className="login-error">{memberError}</p>}

                <div className="create-form-actions">
                  <button
                    type="button"
                    className="cancel-form-btn"
                    onClick={() => {
                      setShowAddMember(false);
                      setUserId("");
                      setMemberError("");
                    }}
                    disabled={addingMember}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="submit-project-btn"
                    disabled={addingMember}
                  >
                    <UserPlus size={16} />
                    {addingMember ? "Adding..." : "Add Member"}
                  </button>
                </div>
              </div>
            </form>
          )}

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
