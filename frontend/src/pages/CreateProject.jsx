import { useState } from "react";
import { FolderKanban, ArrowLeft, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";

function CreateProject() {
  const navigate = useNavigate();

  const [project, setProject] = useState({
    name: "",
    description: "",
    objective: "",
    startDate: "",
    deadline: "",
  });

  function handleSubmit(event) {
    event.preventDefault();

    console.log("Project Created:", project);

    alert("Project created successfully!");

    setProject({
      name: "",
      description: "",
      objective: "",
      startDate: "",
      deadline: "",
    });
  }

  return (
    <div className="zyra-create-page">
      <button className="back-page-btn" onClick={() => navigate("/projects")}>
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
            ></textarea>
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
            ></textarea>
          </div>
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
              />
            </div>
          </div>
        </div>

        <div className="create-form-actions">
          <button
            type="button"
            className="cancel-form-btn"
            onClick={() => navigate("/projects")}
          >
            Cancel
          </button>

          <button type="submit" className="submit-project-btn">
            <FolderKanban size={16} />
            Create Project
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateProject;
