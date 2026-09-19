import { useEffect, useState } from "react";
import { FolderKanban, ArrowLeft, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { createProject } from "../services/ProjectService";
import { getTeams } from "../services/teamService";

function CreateProject() {
  const navigate = useNavigate();

  const [project, setProject] = useState({
    name: "",
    description: "",
    objective: "",
    startDate: "",
    deadline: "",
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

        if (loadedTeams.length > 0) {
          setProject((current) => ({
            ...current,
            teamId: String(loadedTeams[0].id),
          }));
        }
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

  return (
    <div className="zyra-create-page">
      <button
        className="back-page-btn"
        onClick={() => navigate("/projects")}
        disabled={loading}
      >
        <ArrowLeft size={16} />
        Back to Projects
      </button>

      <div className="create-page-header">
        <div className="create-page-icon">
          <FolderKanban size={22} />
        </div>

        <div>
          <p className="create-page-eyebrow">PROJECT WORKSPACE</p>

          <h2>Create New Project</h2>

          <p>Set up your project and define what your team wants to achieve.</p>
        </div>
      </div>

      <form className="zyra-create-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="form-section-header">
            <h3>Project Information</h3>
            <p>Basic information about your project.</p>
          </div>

          <div className="form-group">
            <label>Project Name</label>

            <input
              type="text"
              placeholder="Enter project name"
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

          <div className="form-group">
            <label>Description</label>

            <textarea
              placeholder="Describe your project"
              rows="5"
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

          <div className="form-group">
            <label>Team</label>

            <select
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
                <option value="">Loading teams...</option>
              ) : teams.length === 0 ? (
                <option value="">No teams available</option>
              ) : (
                <>
                  <option value="">Select a team</option>

                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div className="form-group">
            <label>Project Objective</label>

            <textarea
              placeholder="What do you want to achieve?"
              rows="4"
              value={project.objective}
              onChange={(event) =>
                setProject({
                  ...project,
                  objective: event.target.value,
                })
              }
              required
              disabled={loading}
            ></textarea>
          </div>

          {error && <p className="login-error">{error}</p>}
        </div>

        <div className="form-section">
          <div className="form-section-header">
            <h3>Project Timeline</h3>

            <p>
              Define when the project starts and when it should be completed.
            </p>
          </div>

          <div className="form-date-grid">
            <div className="form-group">
              <label>
                <CalendarDays size={14} />
                Start Date
              </label>

              <input
                type="date"
                value={project.startDate}
                onChange={(event) =>
                  setProject({
                    ...project,
                    startDate: event.target.value,
                  })
                }
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>
                <CalendarDays size={14} />
                Deadline
              </label>

              <input
                type="date"
                value={project.deadline}
                onChange={(event) =>
                  setProject({
                    ...project,
                    deadline: event.target.value,
                  })
                }
                required
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="create-form-actions">
          <button
            type="button"
            className="cancel-form-btn"
            onClick={() => navigate("/projects")}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="submit-project-btn"
            disabled={loading || loadingTeams || teams.length === 0}
          >
            <FolderKanban size={16} />

            {loading ? "Creating Project..." : "Create Project"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateProject;
