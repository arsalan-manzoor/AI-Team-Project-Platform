import {
  FolderKanban,
  Plus,
  ArrowRight,
  CalendarDays,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

function Projects() {
  const navigate = useNavigate();

  return (
    <div className="zyra-projects">
      <div className="projects-header">
        <div>
          <p className="projects-eyebrow">PROJECT WORKSPACE</p>
          <h2>My Projects</h2>
          <p className="projects-subtitle">
            Create, organize, and track everything your team is building.
          </p>
        </div>

        <button
          className="projects-create-btn"
          onClick={() => navigate("/projects/create")}
        >
          <Plus size={17} />
          Create Project
        </button>
      </div>

      <div className="projects-summary">
        <div className="project-summary-card">
          <div className="project-summary-icon">
            <FolderKanban size={19} />
          </div>

          <div>
            <span>Total Projects</span>
            <strong>1</strong>
          </div>
        </div>

        <div className="project-summary-card">
          <div className="project-summary-icon">
            <CalendarDays size={19} />
          </div>

          <div>
            <span>Active Projects</span>
            <strong>1</strong>
          </div>
        </div>

        <div className="project-summary-card">
          <div className="project-summary-icon">
            <Users size={19} />
          </div>

          <div>
            <span>Collaborators</span>
            <strong>0</strong>
          </div>
        </div>
      </div>

      <section className="projects-panel">
        <div className="projects-panel-header">
          <div>
            <h3>Your Projects</h3>
            <p>Projects you are currently working on</p>
          </div>
        </div>

        <div className="project-list">
          <div className="project-card">
            <div className="project-card-main">
              <div className="project-card-icon">
                <FolderKanban size={22} />
              </div>

              <div className="project-card-info">
                <h3>ZYRA — Intelligent Project Workspace</h3>

                <p>
                  A collaborative project workspace that progressively evolves
                  into an AI-powered project assistant.
                </p>

                <div className="project-card-meta">
                  <span>
                    <CalendarDays size={13} />
                    Active Project
                  </span>

                  <span>
                    <Users size={13} />2 Members
                  </span>
                </div>
              </div>
            </div>

            <button
              className="project-open-btn"
              onClick={() => navigate("/projects/zyra-project")}
            >
              Open Project
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Projects;
