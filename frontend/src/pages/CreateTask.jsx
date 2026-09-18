import { useState } from "react";
import {
  CheckSquare,
  ArrowLeft,
  CalendarDays,
  Flag,
  CircleDot,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

function CreateTask() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [task, setTask] = useState({
    name: "",
    description: "",
    priority: "medium",
    deadline: "",
    status: "todo",
  });

  function handleSubmit(event) {
    event.preventDefault();

    console.log("Task Created:", task);

    alert("Task created successfully!");

    setTask({
      name: "",
      description: "",
      priority: "medium",
      deadline: "",
      status: "todo",
    });
  }

  return (
    <div className="zyra-create-page">
      <button
        className="back-page-btn"
        onClick={() => navigate("/projects/tasks")}
      >
        <ArrowLeft size={16} />
        Back to Project Tasks
      </button>

      <div className="create-page-header">
        <div className="create-page-icon">
          <CheckSquare size={22} />
        </div>

        <div>
          <p className="create-page-eyebrow">TASK WORKSPACE</p>
          <h2>Create New Task</h2>
          <p>
            Create a task and define its priority, deadline, and progress
            status.
          </p>
        </div>
      </div>

      <form className="zyra-create-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="form-section-header">
            <h3>Task Information</h3>
            <p>Describe what needs to be completed.</p>
          </div>

          <div className="form-group">
            <label>Task Name</label>

            <input
              type="text"
              placeholder="Enter task name"
              value={task.name}
              onChange={(event) =>
                setTask({
                  ...task,
                  name: event.target.value,
                })
              }
              required
            />
          </div>

          <div className="form-group">
            <label>Task Description</label>

            <textarea
              placeholder="Describe the task"
              rows="5"
              value={task.description}
              onChange={(event) =>
                setTask({
                  ...task,
                  description: event.target.value,
                })
              }
              required
            ></textarea>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-header">
            <h3>Task Details</h3>
            <p>Set the priority, deadline, and current status.</p>
          </div>

          <div className="form-date-grid">
            <div className="form-group">
              <label>
                <Flag size={14} />
                Priority
              </label>

              <select
                value={task.priority}
                onChange={(event) =>
                  setTask({
                    ...task,
                    priority: event.target.value,
                  })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                <CircleDot size={14} />
                Status
              </label>

              <select
                value={task.status}
                onChange={(event) =>
                  setTask({
                    ...task,
                    status: event.target.value,
                  })
                }
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>
              <CalendarDays size={14} />
              Deadline
            </label>

            <input
              type="date"
              value={task.deadline}
              onChange={(event) =>
                setTask({
                  ...task,
                  deadline: event.target.value,
                })
              }
              required
            />
          </div>
        </div>

        <div className="create-form-actions">
          <button
            type="button"
            className="cancel-form-btn"
            onClick={() => navigate("/projects/tasks")}
          >
            Cancel
          </button>

          <button type="submit" className="submit-project-btn">
            <CheckSquare size={16} />
            Create Task
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateTask;
