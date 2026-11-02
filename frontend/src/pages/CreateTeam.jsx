import { useState } from "react";
import { Users, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";

import { createTeam } from "../services/teamService";

function CreateTeam() {
  const navigate = useNavigate();
  const { workspaceId, workspaceType, workspaceRole, activeWorkspace, loading: workspaceLoading } = useWorkspace();

  const [team, setTeam] = useState({
    name: "",
    description: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    const normalizedWorkspaceType = String(workspaceType || "")
      .trim()
      .toUpperCase();

    const normalizedWorkspaceRoles = [
      workspaceRole,
      ...(Array.isArray(activeWorkspace?.roles) ? activeWorkspace.roles : []),
    ]
      .map((role) => String(role || "").trim().toUpperCase())
      .filter(Boolean);

    const hasTeamLeaderRoleForWorkspace =
      normalizedWorkspaceRoles.includes("TEAM_LEADER");

    if (["INDIVIDUAL", "PROJECT", "COMPANY"].includes(normalizedWorkspaceType)) {
      if (
        !workspaceId ||
        !Number.isInteger(Number(workspaceId)) ||
        Number(workspaceId) <= 0
      ) {
        setError(
          `No valid ${normalizedWorkspaceType.toLowerCase()} workspace was found. Please refresh and try again.`,
        );
        return;
      }

      if (!hasTeamLeaderRoleForWorkspace) {
        setError(
          "Only a Workspace Team Leader can create teams in this workspace.",
        );
        return;
      }
    }

    try {
      setLoading(true);

      const teamData = {
        name: team.name.trim(),
        description: team.description.trim(),
      };

      if (workspaceId) {
        teamData.workspaceId = Number(workspaceId);
      }

      await createTeam(teamData);

      alert("Team created successfully!");

      navigate("/teams");
    } catch (error) {
      console.error("Team creation error:", error);
      setError(error.message || "Failed to create team.");
    } finally {
      setLoading(false);
    }
  }

  if (workspaceLoading) {
    return (
      <div className="zyra-create-page">
        <div className="teams-empty">
          <h3>Loading workspace...</h3>
          <p>Checking your team-management permissions.</p>
        </div>
      </div>
    );
  }

  if (workspaceType === "COMPANY" && String(workspaceRole || "").toUpperCase() !== "TEAM_LEADER") {
    return (
      <div className="zyra-create-page">
        <div className="teams-empty">
          <div className="teams-empty-icon">
            <Users size={28} />
          </div>
          <h3>Team creation restricted</h3>
          <p>Only a Company Team Leader can create teams in this workspace.</p>
          <button
            type="button"
            className="back-page-btn"
            onClick={() => navigate("/teams")}
          >
            <ArrowLeft size={16} />
            Back to Teams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="zyra-create-page">
      <button
        className="back-page-btn"
        onClick={() => navigate("/teams")}
        disabled={loading}
      >
        <ArrowLeft size={16} />
        Back to Teams
      </button>

      <div className="create-page-header">
        <div className="create-page-icon">
          <Users size={22} />
        </div>

        <div>
          <p className="create-page-eyebrow">TEAM WORKSPACE</p>

          <h2>Create New Team</h2>

          <p>
            Set up your team and define what you want to accomplish together.
          </p>
        </div>
      </div>

      <form className="zyra-create-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="form-section-header">
            <h3>Team Information</h3>

            <p>Basic information about your team.</p>
          </div>

          <div className="form-group">
            <label>Team Name</label>

            <input
              type="text"
              placeholder="Enter team name"
              value={team.name}
              onChange={(event) =>
                setTeam({
                  ...team,
                  name: event.target.value,
                })
              }
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Team Description</label>

            <textarea
              placeholder="Describe your team"
              rows="5"
              value={team.description}
              onChange={(event) =>
                setTeam({
                  ...team,
                  description: event.target.value,
                })
              }
              required
              disabled={loading}
            ></textarea>
          </div>

          {error && <p className="login-error">{error}</p>}
        </div>

        <div className="create-form-actions">
          <button
            type="button"
            className="cancel-form-btn"
            onClick={() => navigate("/teams")}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="submit-project-btn"
            disabled={loading}
          >
            <Users size={16} />
            {loading ? "Creating Team..." : "Create Team"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateTeam;
