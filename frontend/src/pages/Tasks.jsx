import { CheckSquare, Clock3, CircleCheck, AlertCircle } from "lucide-react";

function Tasks() {
  return (
    <div className="zyra-tasks">
      <div className="tasks-header">
        <div>
          <p className="tasks-eyebrow">TASK WORKSPACE</p>
          <h2>My Tasks</h2>
          <p className="tasks-subtitle">
            View and manage the tasks assigned to you across your projects.
          </p>
        </div>
      </div>

      <div className="tasks-summary">
        <div className="task-summary-card">
          <div className="task-summary-icon">
            <CheckSquare size={19} />
          </div>
          <div>
            <span>Total Tasks</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="task-summary-card">
          <div className="task-summary-icon">
            <Clock3 size={19} />
          </div>
          <div>
            <span>In Progress</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="task-summary-card">
          <div className="task-summary-icon">
            <CircleCheck size={19} />
          </div>
          <div>
            <span>Completed</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="task-summary-card">
          <div className="task-summary-icon">
            <AlertCircle size={19} />
          </div>
          <div>
            <span>Overdue</span>
            <strong>0</strong>
          </div>
        </div>
      </div>

      <section className="tasks-panel">
        <div className="tasks-panel-header">
          <div>
            <h3>Assigned Tasks</h3>
            <p>Tasks assigned to you across your projects</p>
          </div>
        </div>

        <div className="tasks-empty">
          <div className="tasks-empty-icon">
            <CheckSquare size={28} />
          </div>

          <h3>No tasks assigned</h3>

          <p>
            Your assigned tasks will appear here when you start working on a
            project with your team.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Tasks;
