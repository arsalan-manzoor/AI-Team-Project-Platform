import {
  ArrowLeft,
  CheckSquare,
  CalendarDays,
  Flag,
  CircleDot,
  Plus,
  X,
  MessageSquare,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getTaskById,
  getTaskSubtasks,
  createSubtask,
} from "../services/taskService";

import {
  getTaskComments,
  createComment,
} from "../services/commentService";

function TaskDetails() {
  const navigate = useNavigate();
  const { projectId, taskId } = useParams();

  const [task, setTask] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [comments, setComments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [creatingComment, setCreatingComment] = useState(false);

  const [showSubtaskForm, setShowSubtaskForm] = useState(false);

  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [commentContent, setCommentContent] = useState("");

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTask() {
      try {
        setLoading(true);
        setError("");

        const taskData = await getTaskById(taskId);

        const subtasksData = await getTaskSubtasks(taskId);

        const commentsData = await getTaskComments(taskId);

        setTask(taskData);

        setSubtasks(
          Array.isArray(subtasksData) ? subtasksData : [],
        );

        setComments(
          Array.isArray(commentsData) ? commentsData : [],
        );
      } catch (error) {
        console.error("Task details loading error:", error);

        setError(
          error.message || "Failed to load task details.",
        );
      } finally {
        setLoading(false);
      }
    }

    if (taskId) {
      loadTask();
    }
  }, [taskId]);

  function getDisplayStatus(status) {
    switch (status) {
      case "in_progress":
        return "In Progress";

      case "completed":
      case "complete":
      case "done":
        return "Completed";

      case "todo":
        return "To Do";

      case "pending":
        return "Pending";

      default:
        return status || "To Do";
    }
  }

  async function handleCreateSubtask(event) {
    event.preventDefault();

    const title = subtaskTitle.trim();

    if (!title) {
      setError("Please enter a subtask title.");
      return;
    }

    try {
      setCreatingSubtask(true);
      setError("");

      const newSubtask = await createSubtask({
        title,
        taskId: Number(taskId),
      });

      setSubtasks((currentSubtasks) => [
        ...currentSubtasks,
        newSubtask,
      ]);

      setSubtaskTitle("");
      setShowSubtaskForm(false);
    } catch (error) {
      console.error("Subtask creation error:", error);

      setError(
        error.message || "Failed to create subtask.",
      );
    } finally {
      setCreatingSubtask(false);
    }
  }

  async function handleCreateComment(event) {
    event.preventDefault();

    const content = commentContent.trim();

    if (!content) {
      setError("Please enter a comment.");
      return;
    }

    try {
      setCreatingComment(true);
      setError("");

      const newComment = await createComment({
        content,
        taskId: Number(taskId),
      });

      setComments((currentComments) => [
        ...currentComments,
        newComment,
      ]);

      setCommentContent("");
    } catch (error) {
      console.error("Comment creation error:", error);

      setError(
        error.message || "Failed to create comment.",
      );
    } finally {
      setCreatingComment(false);
    }
  }

  return (
    <div className="zyra-task-details">
      <button
        className="back-page-btn"
        onClick={() =>
          navigate(`/projects/${projectId}/tasks`)
        }
        disabled={creatingSubtask || creatingComment}
      >
        <ArrowLeft size={16} />
        Back to Project Tasks
      </button>

      {error && (
        <div className="dashboard-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="task-details-empty">
          <CheckSquare size={28} />

          <h3>Loading task...</h3>

          <p>
            Getting task details from the ZYRA workspace.
          </p>
        </div>
      ) : !task ? (
        <div className="task-details-empty">
          <CheckSquare size={28} />

          <h3>Task not found</h3>

          <p>
            The requested task could not be found.
          </p>
        </div>
      ) : (
        <>
          {/* Task Header */}
          <div className="task-details-header">
            <div className="task-details-icon">
              <CheckSquare size={22} />
            </div>

            <div>
              <p className="task-details-eyebrow">
                TASK WORKSPACE
              </p>

              <h2>{task.title}</h2>

              <p>
                View task information, manage subtasks,
                and track progress.
              </p>
            </div>
          </div>

          <section className="task-details-panel">
            {/* Task Information */}
            <div className="task-details-section">
              <h3>Task Information</h3>

              <p>
                {task.description ||
                  "No description provided."}
              </p>

              <div className="task-details-meta">
                <span>
                  <CircleDot size={15} />

                  Status:{" "}
                  {getDisplayStatus(task.status)}
                </span>

                <span>
                  <Flag size={15} />

                  Priority:{" "}
                  {task.priority || "Medium"}
                </span>

                <span>
                  <CalendarDays size={15} />

                  Deadline:{" "}
                  {task.deadline || "No deadline"}
                </span>
              </div>
            </div>

            {/* Subtasks */}
            <div className="task-details-section">
              <div className="task-details-section-header">
                <div>
                  <h3>Subtasks</h3>

                  <p>
                    Break this task into smaller pieces
                    of work.
                  </p>
                </div>

                {!showSubtaskForm && (
                  <button
                    type="button"
                    className="task-details-add-btn"
                    onClick={() =>
                      setShowSubtaskForm(true)
                    }
                  >
                    <Plus size={16} />
                    Add Subtask
                  </button>
                )}
              </div>

              {showSubtaskForm && (
                <form
                  className="task-subtask-form"
                  onSubmit={handleCreateSubtask}
                >
                  <div className="form-group">
                    <label>Subtask Title</label>

                    <input
                      type="text"
                      placeholder="Enter subtask title"
                      value={subtaskTitle}
                      onChange={(event) =>
                        setSubtaskTitle(
                          event.target.value,
                        )
                      }
                      disabled={creatingSubtask}
                      autoFocus
                    />
                  </div>

                  <div className="task-subtask-form-actions">
                    <button
                      type="button"
                      className="cancel-form-btn"
                      onClick={() => {
                        setShowSubtaskForm(false);
                        setSubtaskTitle("");
                        setError("");
                      }}
                      disabled={creatingSubtask}
                    >
                      <X size={15} />
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="submit-project-btn"
                      disabled={
                        creatingSubtask ||
                        !subtaskTitle.trim()
                      }
                    >
                      <Plus size={15} />

                      {creatingSubtask
                        ? "Adding..."
                        : "Add Subtask"}
                    </button>
                  </div>
                </form>
              )}

              {subtasks.length === 0 ? (
                <div className="task-details-empty">
                  <CheckSquare size={28} />

                  <h3>No subtasks yet</h3>

                  <p>
                    Add subtasks to divide this task
                    into smaller, manageable steps.
                  </p>
                </div>
              ) : (
                <div className="task-subtask-list">
                  {subtasks.map((subtask) => (
                    <div
                      className="task-subtask-item"
                      key={subtask.id}
                    >
                      <CheckSquare size={17} />

                      <span>
                        {subtask.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="task-details-section">
              <div className="task-details-section-header">
                <div>
                  <h3>Comments</h3>

                  <p>
                    Discuss this task with your team.
                  </p>
                </div>
              </div>

              {/* Create Comment */}
              <form
                className="task-subtask-form"
                onSubmit={handleCreateComment}
              >
                <div className="form-group">
                  <label>Comment</label>

                  <textarea
                    placeholder="Write a comment..."
                    value={commentContent}
                    onChange={(event) =>
                      setCommentContent(
                        event.target.value,
                      )
                    }
                    disabled={creatingComment}
                    rows="3"
                  />
                </div>

                <div className="task-subtask-form-actions">
                  <button
                    type="submit"
                    className="submit-project-btn"
                    disabled={
                      creatingComment ||
                      !commentContent.trim()
                    }
                  >
                    <MessageSquare size={15} />

                    {creatingComment
                      ? "Posting..."
                      : "Post Comment"}
                  </button>
                </div>
              </form>

              {/* Comment List */}
              {comments.length === 0 ? (
                <div className="task-details-empty">
                  <MessageSquare size={28} />

                  <h3>No comments yet</h3>

                  <p>
                    Start a conversation about this task.
                  </p>
                </div>
              ) : (
                <div className="task-subtask-list">
                  {comments.map((comment) => (
                    <div
                      className="task-subtask-item"
                      key={comment.id}
                    >
                      <MessageSquare size={17} />

                      <span>
                        {comment.content}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default TaskDetails;