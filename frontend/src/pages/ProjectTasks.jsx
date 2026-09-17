import {
  CheckSquare,
  Plus,
  ArrowLeft,
  Clock3,
  CircleCheck,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

function ProjectTasks() {
  const navigate = useNavigate();

  return (
    <div className="zyra-project-tasks">
      <button className="back-page-btn" onClick={() => navigate("/projects")}>
        <ArrowLeft size={16} />
        Back to Projects
      </button>

      <div className="project-tasks-header">
        <div>
          <p className="project-tasks-eyebrow">PROJECT WORKSPACE</p>
          <h2>Project Tasks</h2>
          <p className="project-tasks-subtitle">
            Create, assign, and track tasks for this project.
          </p>
        </div>

        <button
          className="project-tasks-create-btn"
          onClick={() => navigate("/projects/tasks/create")}
        >
          <Plus size={17} />
          Create New Task
        </button>
      </div>

      <div className="project-tasks-summary">
        <div className="project-task-summary-card">
          <div className="project-task-summary-icon">
            <CheckSquare size={19} />
          </div>

          <div>
            <span>Total Tasks</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="project-task-summary-card">
          <div className="project-task-summary-icon">
            <Clock3 size={19} />
          </div>

          <div>
            <span>In Progress</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="project-task-summary-card">
          <div className="project-task-summary-icon">
            <CircleCheck size={19} />
          </div>

          <div>
            <span>Completed</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="project-task-summary-card">
          <div className="project-task-summary-icon">
            <AlertCircle size={19} />
          </div>

          <div>
            <span>Pending</span>
            <strong>0</strong>
          </div>
        </div>
      </div>

      <section className="project-tasks-panel">
        <div className="project-tasks-panel-header">
          <div>
            <h3>Project Task List</h3>
            <p>Tasks created for this project will appear here.</p>
          </div>
        </div>

        <div className="project-tasks-empty">
          <div className="project-tasks-empty-icon">
            <CheckSquare size={28} />
          </div>

          <h3>No tasks yet</h3>

          <p>
            Create your first task to start organizing and tracking the work for
            this project.
          </p>

          <button
            className="project-tasks-empty-btn"
            onClick={() => navigate("/projects/tasks/create")}
          >
            <Plus size={16} />
            Create Your First Task
          </button>
        </div>
      </section>
    </div>
  );
}

export default ProjectTasks;
