import {
  FolderKanban,
  CheckSquare,
  Users,
  Clock3,
  ArrowRight,
  Plus,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();
  return (
    <div className="zyra-dashboard">
      {/* PAGE HEADER */}

      <div className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">WORKSPACE OVERVIEW</p>

          <h2>Welcome back, Arsalan</h2>

          <p className="dashboard-subtitle">
            Here's what's happening across your projects and teams.
          </p>
        </div>

        <button
          className="dashboard-create-btn"
          onClick={() => navigate("/projects/create")}
        >
          <Plus size={17} />
          Create Project
        </button>
      </div>

      {/* SUMMARY CARDS */}

      <div className="dashboard-stats">
        <div className="dashboard-stat-card">
          <div className="stat-icon">
            <FolderKanban size={20} />
          </div>

          <div className="stat-content">
            <span>Total Projects</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="stat-icon">
            <CheckSquare size={20} />
          </div>

          <div className="stat-content">
            <span>Active Tasks</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="stat-icon">
            <Users size={20} />
          </div>

          <div className="stat-content">
            <span>Team Members</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="stat-icon">
            <Clock3 size={20} />
          </div>

          <div className="stat-content">
            <span>Pending Tasks</span>
            <strong>0</strong>
          </div>
        </div>
      </div>

      {/* MAIN DASHBOARD GRID */}

      <div className="dashboard-grid">
        {/* RECENT PROJECTS */}

        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3>Recent Projects</h3>
              <p>Your latest project activity</p>
            </div>

            <button
              className="panel-link"
              onClick={() => navigate("/projects")}
            >
              View all <ArrowRight size={15} />
            </button>
          </div>

          <div className="dashboard-empty">
            <FolderKanban size={30} />

            <h4>No projects yet</h4>

            <p>
              Create your first project to start organizing your work with ZYRA.
            </p>

            <button
              className="empty-action"
              onClick={() => navigate("/projects/create")}
            >
              <Plus size={16} />
              Create Project
            </button>
          </div>
        </section>

        {/* MY TASKS */}

        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3>My Tasks</h3>
              <p>Tasks assigned to you</p>
            </div>

            <button className="panel-link" onClick={() => navigate("/tasks")}>
              View all <ArrowRight size={15} />
            </button>
          </div>

          <div className="dashboard-empty">
            <CheckSquare size={30} />

            <h4>No tasks yet</h4>

            <p>
              Your assigned tasks will appear here once you start working on a
              project.
            </p>
          </div>
        </section>
      </div>

      {/* AI ASSISTANT PANEL */}

      <section className="dashboard-ai-panel">
        <div className="ai-panel-icon">✦</div>

        <div className="ai-panel-content">
          <span>ZYRA AI ASSISTANT</span>

          <h3>Your intelligent project assistant is coming.</h3>

          <p>
            ZYRA will eventually help you understand project progress, identify
            delayed work, summarize information, and provide intelligent
            recommendations.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
