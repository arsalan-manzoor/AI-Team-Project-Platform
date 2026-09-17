import { useState } from "react";
import { Users, ArrowLeft, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

function CreateTeam() {
  const navigate = useNavigate();

  const [team, setTeam] = useState({
    name: "",
    description: "",
    objective: "",
  });

  function handleSubmit(event) {
    event.preventDefault();

    console.log("Team Created:", team);

    alert("Team created successfully!");

    setTeam({
      name: "",
      description: "",
      objective: "",
    });
  }

  return (
    <div className="zyra-create-page">
      <button className="back-page-btn" onClick={() => navigate("/teams")}>
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
            ></textarea>
          </div>
        </div>

        <div className="create-form-actions">
          <button
            type="button"
            className="cancel-form-btn"
            onClick={() => navigate("/teams")}
          >
            Cancel
          </button>

          <button type="submit" className="submit-project-btn">
            <Users size={16} />
            Create Team
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateTeam;
