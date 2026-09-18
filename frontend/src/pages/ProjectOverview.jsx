import {
  FolderKanban,
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  CircleCheck,
  Clock3,
  Users,
  CalendarDays,
} from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";

function ProjectOverview() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  return (
    <div className="zyra-project-overview">
      {/* Back to Projects */}
      <button
        type="button"
        className="back-page-btn"
        onClick={() => navigate("/projects")}
      >
        <ArrowLeft size={16} />
        Back to Projects
      </button>

      {/* Project Header */}
      <div className="project-overview-header">
        <div className="project-overview-title">
          <div className="project-overview-icon">
            <FolderKanban size={22} />
          </div>

          <div>
            <p className="project-overview-eyebrow">PROJECT WORKSPACE</p>

            <h2>Project Overview</h2>

            <p>View your project's progress, tasks, and team information.</p>
          </div>
        </div>

        {/* View Project Tasks */}
        <button
          type="button"
          className="project-overview-tasks-btn"
          onClick={() => navigate(`/projects/${projectId}/tasks`)}
        >
          <CheckSquare size={16} />
          View Project Tasks
          <ArrowRight size={15} />
        </button>
      </div>

      {/* Project Information */}
      <section className="project-overview-panel">
        <div className="project-overview-panel-header">
          <div>
            <h3>Project Information</h3>
            <p>Basic information about this project.</p>
          </div>
        </div>

        <div className="project-overview-info">
          <div className="project-info-item">
            <span>Project Name</span>
            <strong>ZYRA — Intelligent Project Workspace</strong>
          </div>

          <div className="project-info-item">
            <span>Status</span>
            <strong>Active</strong>
          </div>

          <div className="project-info-item">
            <span>Project ID</span>
            <strong>{projectId}</strong>
          </div>
        </div>
      </section>

      {/* Project Statistics */}
      <div className="project-overview-summary">
        <div className="project-overview-stat-card">
          <div className="project-overview-stat-icon">
            <CheckSquare size={19} />
          </div>

          <div>
            <span>Total Tasks</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="project-overview-stat-card">
          <div className="project-overview-stat-icon">
            <CircleCheck size={19} />
          </div>

          <div>
            <span>Completed</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="project-overview-stat-card">
          <div className="project-overview-stat-icon">
            <Clock3 size={19} />
          </div>

          <div>
            <span>Pending</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="project-overview-stat-card">
          <div className="project-overview-stat-icon">
            <Users size={19} />
          </div>

          <div>
            <span>Team Members</span>
            <strong>2</strong>
          </div>
        </div>
      </div>

      {/* Project Details */}
      <section className="project-overview-panel">
        <div className="project-overview-panel-header">
          <div>
            <h3>Project Details</h3>
            <p>Current project information and timeline.</p>
          </div>
        </div>

        <div className="project-details-grid">
          <div className="project-detail-card">
            <CalendarDays size={18} />

            <div>
              <span>Timeline</span>
              <strong>Active Project</strong>
            </div>
          </div>

          <div className="project-detail-card">
            <Users size={18} />

            <div>
              <span>Collaborators</span>
              <strong>2 Members</strong>
            </div>
          </div>

          <div className="project-detail-card">
            <FolderKanban size={18} />

            <div>
              <span>Workspace</span>
              <strong>ZYRA Workspace</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProjectOverview;
