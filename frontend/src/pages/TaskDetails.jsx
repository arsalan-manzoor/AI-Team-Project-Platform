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
  ArrowRight,
  LoaderCircle,
  Eye,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/task-details.css";

import {
  getTaskById,
  getTaskSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  updateTask,
} from "../services/taskService";

import { getCurrentUser } from "../services/authService";
import { useWorkspace } from "../context/WorkspaceContext";

import {
  getTaskComments,
  createComment,
  updateComment,
  deleteComment,
} from "../services/commentService";

function TaskDetails() {
  const navigate = useNavigate();
  const { projectId, taskId } = useParams();

  const {
    activeWorkspace,
    workspaceRole,
    loading: workspaceLoading,
  } = useWorkspace();

  const normalizedWorkspaceRole = String(
    workspaceRole || activeWorkspace?.role || "",
  )
    .trim()
    .toUpperCase();

  const isTeamLeader = normalizedWorkspaceRole === "TEAM_LEADER";

  const [task, setTask] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [comments, setComments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [updatingTaskStatus, setUpdatingTaskStatus] = useState(false);

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

  // ======================================================
  // LOAD TASK
  // ======================================================

  async function loadTask() {
    try {
      setLoading(true);
      setError("");

      const [taskData, subtasksData, commentsData, userData] =
        await Promise.all([
          getTaskById(taskId),
          getTaskSubtasks(taskId),
          getTaskComments(taskId),
          getCurrentUser(),
        ]);

      const signedInUser =
        userData?.user || userData?.data?.user || userData?.data || userData;

      setTask(taskData);
      setSubtasks(Array.isArray(subtasksData) ? subtasksData : []);
      setComments(Array.isArray(commentsData) ? commentsData : []);
      setCurrentUser(signedInUser);
    } catch (error) {
      console.error("Task details loading error:", error);
      setError(error.message || "Failed to load task details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (taskId && !workspaceLoading) {
      loadTask();
    }
  }, [taskId, workspaceLoading]);

  // ======================================================
  // TASK STATUS HELPERS
  // ======================================================

  function normalizeStatus(status) {
    return String(status || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  }

  function getDisplayStatus(status) {
    const normalized = normalizeStatus(status);

    switch (normalized) {
      case "in_progress":
        return "In Progress";

      case "in_review":
        return "In Review";

      case "completed":
      case "complete":
      case "done":
        return "Completed";

      case "todo":
      case "to_do":
      case "pending":
      default:
        return "To Do";
    }
  }

  function getTaskProgress(status, progress) {
    const numericProgress = Number(progress);

    if (
      progress !== null &&
      progress !== undefined &&
      progress !== "" &&
      Number.isFinite(numericProgress) &&
      numericProgress >= 0 &&
      numericProgress <= 100
    ) {
      return numericProgress;
    }

    const normalized = normalizeStatus(status);

    switch (normalized) {
      case "in_progress":
        return 50;

      case "in_review":
        return 80;

      case "completed":
      case "complete":
      case "done":
        return 100;

      case "pending":
      case "todo":
      case "to_do":
      default:
        return 0;
    }
  }

  function getNextTaskStatus(status) {
    const normalized = normalizeStatus(status);

    switch (normalized) {
      case "pending":
      case "todo":
      case "to_do":
        return "in_progress";

      case "in_progress":
        return "in_review";

      case "in_review":
        return "completed";

      case "completed":
      case "complete":
      case "done":
      default:
        return null;
    }
  }

  function getNextStatusLabel(status) {
    const normalized = normalizeStatus(status);

    switch (normalized) {
      case "pending":
      case "todo":
      case "to_do":
        return "Start Task";

      case "in_progress":
        return "Send for Review";

      case "in_review":
        return "Complete Task";

      default:
        return "";
    }
  }

  function getProgressLabel(progress) {
    if (progress === 0) return "Not Started";
    if (progress === 50) return "In Progress";
    if (progress === 80) return "In Review";
    if (progress === 100) return "Completed";

    return "In Progress";
  }

  // ======================================================
  // TASK PERMISSIONS
  // ======================================================

  function getTaskAssigneeId() {
    if (!task) {
      return null;
    }

    return task.assigned_to ?? task.assignedTo ?? null;
  }

  function isTaskAssignedToCurrentUser() {
    if (!task || currentUser?.id === null || currentUser?.id === undefined) {
      return false;
    }

    const assignedTo = getTaskAssigneeId();

    return (
      assignedTo !== null &&
      assignedTo !== undefined &&
      assignedTo !== "" &&
      Number(assignedTo) === Number(currentUser.id)
    );
  }

  function canUpdateTask() {
    return isTaskAssignedToCurrentUser();
  }

  // ======================================================
  // COMMENT OWNERSHIP AND DISPLAY HELPERS
  // ======================================================

  function isCommentAuthor(comment) {
    if (
      comment?.user_id === null ||
      comment?.user_id === undefined ||
      currentUser?.id === null ||
      currentUser?.id === undefined
    ) {
      return false;
    }

    return Number(comment.user_id) === Number(currentUser.id);
  }

  function getCommenterName(comment) {
    const savedName = String(comment?.user_name || "").trim();

    if (savedName) {
      return savedName;
    }

    if (isCommentAuthor(comment)) {
      return "You";
    }

    if (comment?.user_id !== null && comment?.user_id !== undefined) {
      return `User #${comment.user_id}`;
    }

    return "Unknown user";
  }

  function formatCommentDate(createdAt) {
    if (!createdAt) {
      return "";
    }

    const date = new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  // ======================================================
  // ADVANCE TASK
  // ======================================================

  async function handleAdvanceTask() {
    if (!task || updatingTaskStatus) {
      return;
    }

    if (!canUpdateTask()) {
      setError("You can update only tasks assigned to your account.");
      return;
    }

    const nextStatus = getNextTaskStatus(task.status);

    if (!nextStatus) {
      return;
    }

    try {
      setUpdatingTaskStatus(true);
      setError("");

      const updatedTask = await updateTask(task.id, {
        status: nextStatus,
      });

      setTask((currentTask) => ({
        ...currentTask,
        ...(updatedTask || {}),
        status: updatedTask?.status || nextStatus,
        progress:
          updatedTask?.progress ?? getTaskProgress(nextStatus, undefined),
      }));
    } catch (error) {
      console.error("Task status update error:", error);
      setError(error.message || "Failed to update task status.");
    } finally {
      setUpdatingTaskStatus(false);
    }
  }

  // ======================================================
  // SUBTASK HELPERS
  // ======================================================

  function isSubtaskCompleted(subtask) {
    return ["completed", "complete", "done"].includes(
      normalizeStatus(subtask?.status),
    );
  }

  // ======================================================
  // CREATE SUBTASK
  // ======================================================

  async function handleCreateSubtask(event) {
    event.preventDefault();

    if (!isTeamLeader) {
      setError("Only the Workspace Team Leader can create subtasks.");
      return;
    }

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

  // ======================================================
  // UPDATE SUBTASK STATUS
  // ======================================================

  async function handleToggleSubtask(subtask) {
    if (!isTeamLeader) {
      setError("Only the Workspace Team Leader can update subtasks.");
      return;
    }

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

  // ======================================================
  // EDIT SUBTASK
  // ======================================================

  function handleStartEditSubtask(subtask) {
    if (!isTeamLeader) {
      setError("Only the Workspace Team Leader can update subtasks.");
      return;
    }

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

    if (!isTeamLeader) {
      setError("Only the Workspace Team Leader can update subtasks.");
      return;
    }

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

  // ======================================================
  // DELETE SUBTASK
  // ======================================================

  async function handleDeleteSubtask(subtask) {
    if (!isTeamLeader) {
      setError("Only the Workspace Team Leader can delete subtasks.");
      return;
    }

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

  // ======================================================
  // COMMENTS
  // ======================================================

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
    if (!isCommentAuthor(comment)) {
      setError("You can edit only comments you wrote.");
      return;
    }

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

    if (!isCommentAuthor(comment)) {
      setError("You can edit only comments you wrote.");
      return;
    }

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
    if (!isCommentAuthor(comment)) {
      setError("You can delete only comments you wrote.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete your comment?",
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

  // ======================================================
  // DISPLAY VALUES
  // ======================================================

  const taskProgress = task ? getTaskProgress(task.status, task.progress) : 0;

  const nextTaskStatus = task ? getNextTaskStatus(task.status) : null;

  const nextStatusLabel = task ? getNextStatusLabel(task.status) : "";

  const taskCanBeUpdated = canUpdateTask();

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="zyra-task-details">
      <button
        className="back-page-btn"
        onClick={() => navigate(`/projects/${projectId}/tasks`)}
        disabled={
          updatingTaskStatus ||
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
            {/* TASK INFORMATION */}
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

              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  borderRadius: "14px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "rgba(255, 255, 255, 0.025)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                    gap: "12px",
                  }}
                >
                  <div>
                    <strong>Task Progress</strong>

                    <p
                      style={{
                        margin: "4px 0 0",
                        opacity: 0.65,
                        fontSize: "13px",
                      }}
                    >
                      {getProgressLabel(taskProgress)}
                    </p>
                  </div>

                  <strong>{taskProgress}%</strong>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    borderRadius: "999px",
                    background: "rgba(255, 255, 255, 0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${taskProgress}%`,
                      height: "100%",
                      borderRadius: "999px",
                      background: "linear-gradient(90deg, #22d3ee, #6366f1)",
                      transition: "width 0.35s ease",
                    }}
                  />
                </div>

                {nextTaskStatus && taskCanBeUpdated ? (
                  <button
                    type="button"
                    className="submit-project-btn"
                    onClick={handleAdvanceTask}
                    disabled={updatingTaskStatus}
                    style={{
                      marginTop: "16px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {updatingTaskStatus ? (
                      <>
                        <LoaderCircle
                          size={16}
                          style={{
                            animation: "zyra-spin 1s linear infinite",
                          }}
                        />
                        Updating...
                      </>
                    ) : (
                      <>
                        {nextStatusLabel}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                ) : nextTaskStatus && !taskCanBeUpdated ? (
                  <div
                    style={{
                      marginTop: "16px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      opacity: 0.75,
                      fontSize: "14px",
                    }}
                  >
                    <Eye size={17} />
                    {isTeamLeader ? "Tracking only" : "View only"}
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: "16px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      opacity: 0.75,
                      fontSize: "14px",
                    }}
                  >
                    <CheckCircle2 size={17} />
                    Task completed
                  </div>
                )}
              </div>
            </div>

            {/* SUBTASKS */}
            <div className="task-details-section">
              <div className="task-details-section-header">
                <div>
                  <h3>Subtasks</h3>
                  <p>Break this task into smaller pieces of work.</p>
                </div>

                {isTeamLeader && !showSubtaskForm && (
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

              {isTeamLeader && showSubtaskForm && (
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
                          disabled={
                            !isTeamLeader || updating || deleting || editing
                          }
                          style={{
                            border: "none",
                            background: "transparent",
                            padding: "2px",
                            cursor:
                              !isTeamLeader || updating || deleting || editing
                                ? "default"
                                : "pointer",
                            display: "flex",
                            alignItems: "center",
                          }}
                          title={
                            !isTeamLeader
                              ? "View only"
                              : completed
                                ? "Mark as pending"
                                : "Mark as completed"
                          }
                          aria-label={
                            completed ? "Subtask completed" : "Subtask pending"
                          }
                        >
                          {completed ? (
                            <CheckCircle2 size={19} />
                          ) : (
                            <Circle size={19} />
                          )}
                        </button>

                        {isTeamLeader && editing ? (
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
                              style={{ flex: 1 }}
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
                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px",
                              }}
                            >
                              <span>{subtask.title}</span>

                              <small
                                style={{
                                  fontSize: "11px",
                                  opacity: 0.65,
                                  lineHeight: 1.5,
                                }}
                              >
                                {subtask.created_by_name
                                  ? `Created by ${subtask.created_by_name}`
                                  : "Creator unavailable"}

                                {subtask.created_at
                                  ? ` · ${formatCommentDate(subtask.created_at)}`
                                  : ""}
                              </small>
                            </div>

                            {isTeamLeader && (
                              <>
                                <button
                                  type="button"
                                  className="cancel-form-btn"
                                  onClick={() =>
                                    handleStartEditSubtask(subtask)
                                  }
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
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* COMMENTS */}
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
                    const isAuthor = isCommentAuthor(comment);
                    const editing = isAuthor && editingCommentId === comment.id;
                    const updating = updatingCommentId === comment.id;
                    const deleting = deletingCommentId === comment.id;

                    return (
                      <div
                        className="task-subtask-item"
                        key={comment.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "12px",
                        }}
                      >
                        <MessageSquare
                          size={17}
                          style={{
                            flexShrink: 0,
                            marginTop: "3px",
                          }}
                        />

                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: "5px",
                          }}
                        >
                          {/* COMMENT AUTHOR */}
                          <strong
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#67e8f9",
                            }}
                          >
                            {getCommenterName(comment)}
                          </strong>

                          {/* COMMENT CONTENT */}
                          {editing ? (
                            <form
                              onSubmit={(event) =>
                                handleUpdateComment(event, comment)
                              }
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                flexWrap: "wrap",
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
                                  flex: "1 1 180px",
                                  minWidth: 0,
                                }}
                              />

                              <button
                                type="submit"
                                className="submit-project-btn"
                                disabled={
                                  updating || !editCommentContent.trim()
                                }
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
                            <span
                              style={{
                                overflowWrap: "anywhere",
                                lineHeight: 1.5,
                              }}
                            >
                              {comment.content}
                            </span>
                          )}

                          {/* COMMENT TIMESTAMP */}
                          {comment.created_at && (
                            <small
                              style={{
                                fontSize: "11px",
                                opacity: 0.6,
                              }}
                            >
                              {formatCommentDate(comment.created_at)}
                            </small>
                          )}
                        </div>

                        {/* ONLY THE AUTHOR CAN EDIT OR DELETE */}
                        {!editing && isAuthor && (
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              flexShrink: 0,
                            }}
                          >
                            <button
                              type="button"
                              className="cancel-form-btn"
                              onClick={() => handleStartEditComment(comment)}
                              disabled={updating || deleting}
                              title="Edit your comment"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>

                            <button
                              type="button"
                              className="cancel-form-btn"
                              onClick={() => handleDeleteComment(comment)}
                              disabled={updating || deleting}
                              title="Delete your comment"
                            >
                              <Trash2 size={14} />
                              {deleting ? "Deleting..." : "Delete"}
                            </button>
                          </div>
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
