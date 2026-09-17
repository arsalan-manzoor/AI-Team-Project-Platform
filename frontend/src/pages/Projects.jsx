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
            <strong>0</strong>
          </div>
        </div>

        <div className="project-summary-card">
          <div className="project-summary-icon">
            <CalendarDays size={19} />
          </div>
          <div>
            <span>Active Projects</span>
            <strong>0</strong>
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

        <div className="projects-empty">
          <div className="projects-empty-icon">
            <FolderKanban size={28} />
          </div>

          <h3>No projects yet</h3>

          <p>
            Create your first project and start organizing your team's work with
            ZYRA.
          </p>

          <button
            className="projects-empty-btn"
            onClick={() => navigate("/projects/create")}
          >
            <Plus size={16} />
            Create Your First Project
          </button>
        </div>
      </section>
    </div>
  );
}

export default Projects;
