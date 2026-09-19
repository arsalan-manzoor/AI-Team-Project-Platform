import { useState } from "react";
import { Users, ArrowLeft, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { createTeam } from "../services/teamService";

function CreateTeam() {
  const navigate = useNavigate();

  const [team, setTeam] = useState({
    name: "",
    description: "",
    objective: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    try {
      setLoading(true);

      await createTeam({
        name: team.name.trim(),
        description: team.description.trim(),
      });

      alert("Team created successfully!");

      navigate("/teams");
    } catch (error) {
      console.error("Team creation error:", error);
      setError(error.message || "Failed to create team.");
    } finally {
      setLoading(false);
    }
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

          <div className="form-group">
            <label>
              <Target size={14} />
              Team Objective
            </label>

            <textarea
              placeholder="What does your team want to achieve?"
              rows="4"
              value={team.objective}
              onChange={(event) =>
                setTeam({
                  ...team,
                  objective: event.target.value,
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
