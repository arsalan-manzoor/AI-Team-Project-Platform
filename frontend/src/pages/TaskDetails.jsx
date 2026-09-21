import {
  ArrowLeft,
  CheckSquare,
  CalendarDays,
  Flag,
  CircleDot,
  Plus,
  X,
  MessageSquare,
  Pencil,
  Trash2,
  Circle,
  CheckCircle2,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getTaskById,
  getTaskSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
} from "../services/taskService";

import {
  getTaskComments,
  createComment,
  updateComment,
  deleteComment,
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

  const [updatingSubtaskId, setUpdatingSubtaskId] = useState(null);
  const [deletingSubtaskId, setDeletingSubtaskId] = useState(null);

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [updatingCommentId, setUpdatingCommentId] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  const [showSubtaskForm, setShowSubtaskForm] = useState(false);

  const [editingSubtaskId, setEditingSubtaskId] = useState(null);

  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [editSubtaskTitle, setEditSubtaskTitle] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [editCommentContent, setEditCommentContent] = useState("");

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

        setSubtasks(Array.isArray(subtasksData) ? subtasksData : []);

        setComments(Array.isArray(commentsData) ? commentsData : []);
      } catch (error) {
        console.error("Task details loading error:", error);

        setError(error.message || "Failed to load task details.");
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

  function isSubtaskCompleted(subtask) {
    return (
      subtask.status === "completed" ||
      subtask.status === "complete" ||
      subtask.status === "done" ||
      subtask.status === "Completed"
    );
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

      setSubtasks((currentSubtasks) => [...currentSubtasks, newSubtask]);

      setSubtaskTitle("");
      setShowSubtaskForm(false);
    } catch (error) {
      console.error("Subtask creation error:", error);

      setError(error.message || "Failed to create subtask.");
    } finally {
      setCreatingSubtask(false);
    }
  }

  async function handleToggleSubtask(subtask) {
    const newStatus = isSubtaskCompleted(subtask) ? "pending" : "completed";

    try {
      setUpdatingSubtaskId(subtask.id);
      setError("");

      const updatedSubtask = await updateSubtask(subtask.id, {
        title: subtask.title,
        status: newStatus,
      });

      setSubtasks((currentSubtasks) =>
        currentSubtasks.map((currentSubtask) =>
          currentSubtask.id === subtask.id
            ? {
                ...currentSubtask,
                ...(updatedSubtask || {}),
                status: updatedSubtask?.status || newStatus,
              }
            : currentSubtask,
        ),
      );
    } catch (error) {
      console.error("Subtask status update error:", error);

      setError(error.message || "Failed to update subtask.");
    } finally {
      setUpdatingSubtaskId(null);
    }
  }

  function handleStartEditSubtask(subtask) {
    setEditingSubtaskId(subtask.id);
    setEditSubtaskTitle(subtask.title || "");
    setError("");
  }

  function handleCancelEditSubtask() {
    setEditingSubtaskId(null);
    setEditSubtaskTitle("");
  }

  async function handleUpdateSubtask(event, subtask) {
    event.preventDefault();

    const title = editSubtaskTitle.trim();

    if (!title) {
      setError("Please enter a subtask title.");
      return;
    }

    try {
      setUpdatingSubtaskId(subtask.id);
      setError("");

      const updatedSubtask = await updateSubtask(subtask.id, {
        title,
        status: subtask.status || "pending",
      });

      setSubtasks((currentSubtasks) =>
        currentSubtasks.map((currentSubtask) =>
          currentSubtask.id === subtask.id
            ? {
                ...currentSubtask,
                ...(updatedSubtask || {}),
                title: updatedSubtask?.title || title,
              }
            : currentSubtask,
        ),
      );

      handleCancelEditSubtask();
    } catch (error) {
      console.error("Subtask update error:", error);

      setError(error.message || "Failed to update subtask.");
    } finally {
      setUpdatingSubtaskId(null);
    }
  }

  async function handleDeleteSubtask(subtask) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${subtask.title}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingSubtaskId(subtask.id);
      setError("");

      await deleteSubtask(subtask.id);

      setSubtasks((currentSubtasks) =>
        currentSubtasks.filter(
          (currentSubtask) => currentSubtask.id !== subtask.id,
        ),
      );

      if (editingSubtaskId === subtask.id) {
        handleCancelEditSubtask();
      }
    } catch (error) {
      console.error("Subtask deletion error:", error);

      setError(error.message || "Failed to delete subtask.");
    } finally {
      setDeletingSubtaskId(null);
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

      setComments((currentComments) => [...currentComments, newComment]);

      setCommentContent("");
    } catch (error) {
      console.error("Comment creation error:", error);

      setError(error.message || "Failed to create comment.");
    } finally {
      setCreatingComment(false);
    }
  }

  function handleStartEditComment(comment) {
    setEditingCommentId(comment.id);
    setEditCommentContent(comment.content || "");
    setError("");
  }

  function handleCancelEditComment() {
    setEditingCommentId(null);
    setEditCommentContent("");
  }

  async function handleUpdateComment(event, comment) {
    event.preventDefault();

    const content = editCommentContent.trim();

    if (!content) {
      setError("Comment cannot be empty.");
      return;
    }

    try {
      setUpdatingCommentId(comment.id);
      setError("");

      const updatedComment = await updateComment(comment.id, {
        content,
      });

      setComments((currentComments) =>
        currentComments.map((currentComment) =>
          currentComment.id === comment.id
            ? {
                ...currentComment,
                ...(updatedComment || {}),
                content: updatedComment?.content || content,
              }
            : currentComment,
        ),
      );

      handleCancelEditComment();
    } catch (error) {
      console.error("Comment update error:", error);

      setError(error.message || "Failed to update comment.");
    } finally {
      setUpdatingCommentId(null);
    }
  }

  async function handleDeleteComment(comment) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this comment?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingCommentId(comment.id);
      setError("");

      await deleteComment(comment.id);

      setComments((currentComments) =>
        currentComments.filter(
          (currentComment) => currentComment.id !== comment.id,
        ),
      );

      if (editingCommentId === comment.id) {
        handleCancelEditComment();
      }
    } catch (error) {
      console.error("Comment deletion error:", error);

      setError(error.message || "Failed to delete comment.");
    } finally {
      setDeletingCommentId(null);
    }
  }

  return (
    <div className="zyra-task-details">
      <button
        className="back-page-btn"
        onClick={() => navigate(`/projects/${projectId}/tasks`)}
        disabled={
          creatingSubtask ||
          creatingComment ||
          updatingSubtaskId !== null ||
          deletingSubtaskId !== null ||
          updatingCommentId !== null ||
          deletingCommentId !== null
        }
      >
        <ArrowLeft size={16} />
        Back to Project Tasks
      </button>

      {error && <div className="dashboard-error">{error}</div>}

      {loading ? (
        <div className="task-details-empty">
          <CheckSquare size={28} />

          <h3>Loading task...</h3>

          <p>Getting task details from the ZYRA workspace.</p>
        </div>
      ) : !task ? (
        <div className="task-details-empty">
          <CheckSquare size={28} />

          <h3>Task not found</h3>

          <p>The requested task could not be found.</p>
        </div>
      ) : (
        <>
          <div className="task-details-header">
            <div className="task-details-icon">
              <CheckSquare size={22} />
            </div>

            <div>
              <p className="task-details-eyebrow">TASK WORKSPACE</p>

              <h2>{task.title}</h2>

              <p>View task information, manage subtasks, and track progress.</p>
            </div>
          </div>

          <section className="task-details-panel">
            <div className="task-details-section">
              <h3>Task Information</h3>

              <p>{task.description || "No description provided."}</p>

              <div className="task-details-meta">
                <span>
                  <CircleDot size={15} />
                  Status: {getDisplayStatus(task.status)}
                </span>

                <span>
                  <Flag size={15} />
                  Priority: {task.priority || "Medium"}
                </span>

                <span>
                  <CalendarDays size={15} />
                  Deadline: {task.deadline || "No deadline"}
                </span>
              </div>
            </div>

            <div className="task-details-section">
              <div className="task-details-section-header">
                <div>
                  <h3>Subtasks</h3>

                  <p>Break this task into smaller pieces of work.</p>
                </div>

                {!showSubtaskForm && (
                  <button
                    type="button"
                    className="task-details-add-btn"
                    onClick={() => setShowSubtaskForm(true)}
                    disabled={
                      updatingSubtaskId !== null || deletingSubtaskId !== null
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
                      onChange={(event) => setSubtaskTitle(event.target.value)}
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
                      disabled={creatingSubtask || !subtaskTitle.trim()}
                    >
                      <Plus size={15} />

                      {creatingSubtask ? "Adding..." : "Add Subtask"}
                    </button>
                  </div>
                </form>
              )}

              {subtasks.length === 0 ? (
                <div className="task-details-empty">
                  <CheckSquare size={28} />

                  <h3>No subtasks yet</h3>

                  <p>
                    Add subtasks to divide this task into smaller, manageable
                    steps.
                  </p>
                </div>
              ) : (
                <div className="task-subtask-list">
                  {subtasks.map((subtask) => {
                    const completed = isSubtaskCompleted(subtask);

                    const updating = updatingSubtaskId === subtask.id;

                    const deleting = deletingSubtaskId === subtask.id;

                    const editing = editingSubtaskId === subtask.id;

                    return (
                      <div
                        className="task-subtask-item"
                        key={subtask.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSubtask(subtask)}
                          disabled={updating || deleting || editing}
                          style={{
                            border: "none",
                            background: "transparent",
                            padding: "2px",
                            cursor:
                              updating || deleting || editing
                                ? "default"
                                : "pointer",
                            display: "flex",
                            alignItems: "center",
                          }}
                          title={
                            completed ? "Mark as pending" : "Mark as completed"
                          }
                        >
                          {completed ? (
                            <CheckCircle2 size={19} />
                          ) : (
                            <Circle size={19} />
                          )}
                        </button>

                        {editing ? (
                          <form
                            onSubmit={(event) =>
                              handleUpdateSubtask(event, subtask)
                            }
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flex: 1,
                            }}
                          >
                            <input
                              type="text"
                              value={editSubtaskTitle}
                              onChange={(event) =>
                                setEditSubtaskTitle(event.target.value)
                              }
                              autoFocus
                              disabled={updating}
                              style={{
                                flex: 1,
                              }}
                            />

                            <button
                              type="submit"
                              className="submit-project-btn"
                              disabled={updating || !editSubtaskTitle.trim()}
                            >
                              {updating ? "Saving..." : "Save"}
                            </button>

                            <button
                              type="button"
                              className="cancel-form-btn"
                              onClick={handleCancelEditSubtask}
                              disabled={updating}
                            >
                              <X size={15} />
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <>
                            <span
                              style={{
                                flex: 1,
                              }}
                            >
                              {subtask.title}
                            </span>

                            <button
                              type="button"
                              className="cancel-form-btn"
                              onClick={() => handleStartEditSubtask(subtask)}
                              disabled={updating || deleting}
                              title="Edit subtask"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>

                            <button
                              type="button"
                              className="cancel-form-btn"
                              onClick={() => handleDeleteSubtask(subtask)}
                              disabled={updating || deleting}
                              title="Delete subtask"
                            >
                              <Trash2 size={14} />

                              {deleting ? "Deleting..." : "Delete"}
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="task-details-section">
              <div className="task-details-section-header">
                <div>
                  <h3>Comments</h3>

                  <p>Discuss this task with your team.</p>
                </div>
              </div>

              <form
                className="task-subtask-form"
                onSubmit={handleCreateComment}
              >
                <div className="form-group">
                  <label>Comment</label>

                  <textarea
                    placeholder="Write a comment..."
                    value={commentContent}
                    onChange={(event) => setCommentContent(event.target.value)}
                    disabled={creatingComment}
                    rows="3"
                  />
                </div>

                <div className="task-subtask-form-actions">
                  <button
                    type="submit"
                    className="submit-project-btn"
                    disabled={creatingComment || !commentContent.trim()}
                  >
                    <MessageSquare size={15} />

                    {creatingComment ? "Posting..." : "Post Comment"}
                  </button>
                </div>
              </form>

              {comments.length === 0 ? (
                <div className="task-details-empty">
                  <MessageSquare size={28} />

                  <h3>No comments yet</h3>

                  <p>Start a conversation about this task.</p>
                </div>
              ) : (
                <div className="task-subtask-list">
                  {comments.map((comment) => {
                    const editing = editingCommentId === comment.id;

                    const updating = updatingCommentId === comment.id;

                    const deleting = deletingCommentId === comment.id;

                    return (
                      <div
                        className="task-subtask-item"
                        key={comment.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <MessageSquare size={17} />

                        {editing ? (
                          <form
                            onSubmit={(event) =>
                              handleUpdateComment(event, comment)
                            }
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flex: 1,
                            }}
                          >
                            <input
                              type="text"
                              value={editCommentContent}
                              onChange={(event) =>
                                setEditCommentContent(event.target.value)
                              }
                              autoFocus
                              disabled={updating}
                              style={{
                                flex: 1,
                              }}
                            />

                            <button
                              type="submit"
                              className="submit-project-btn"
                              disabled={updating || !editCommentContent.trim()}
                            >
                              {updating ? "Saving..." : "Save"}
                            </button>

                            <button
                              type="button"
                              className="cancel-form-btn"
                              onClick={handleCancelEditComment}
                              disabled={updating}
                            >
                              <X size={15} />
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <>
                            <span
                              style={{
                                flex: 1,
                              }}
                            >
                              {comment.content}
                            </span>

                            <button
                              type="button"
                              className="cancel-form-btn"
                              onClick={() => handleStartEditComment(comment)}
                              disabled={updating || deleting}
                              title="Edit comment"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>

                            <button
                              type="button"
                              className="cancel-form-btn"
                              onClick={() => handleDeleteComment(comment)}
                              disabled={updating || deleting}
                              title="Delete comment"
                            >
                              <Trash2 size={14} />

                              {deleting ? "Deleting..." : "Delete"}
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
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
