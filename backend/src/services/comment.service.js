const pool = require("../config/db");

function serviceError(message, status = 403) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/*
 * Resolve project and workspace information.
 * Supports independent Company projects and team projects.
 */
async function getProjectContext(projectId) {
  const result = await pool.query(
    `
        SELECT
            p.id,
            p.team_id,

            COALESCE(
                p.workspace_id,
                t.workspace_id
            ) AS workspace_id

        FROM projects p

        LEFT JOIN teams t
          ON t.id = p.team_id

        WHERE p.id = $1
        LIMIT 1
        `,
    [projectId],
  );

  return result.rows[0] || null;
}

/*
 * Check whether the user belongs to the project's
 * workspace or legacy team.
 */
async function verifyProjectMembership(project, userId) {
  if (!project) {
    return false;
  }

  if (project.workspace_id) {
    const result = await pool.query(
      `
            SELECT 1
            FROM workspace_members
            WHERE workspace_id = $1
              AND user_id = $2
            LIMIT 1
            `,
      [project.workspace_id, userId],
    );

    return result.rows.length > 0;
  }

  if (project.team_id) {
    const result = await pool.query(
      `
            SELECT 1
            FROM team_members
            WHERE team_id = $1
              AND user_id = $2
            LIMIT 1
            `,
      [project.team_id, userId],
    );

    return result.rows.length > 0;
  }

  return false;
}

async function createComment({ content, taskId, projectId, userId }) {
  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw serviceError("Authenticated user ID must be a valid integer", 401);
  }

  if (typeof content !== "string" || !content.trim()) {
    throw serviceError("Comment content is required", 400);
  }

  const hasTaskId = taskId !== undefined && taskId !== null && taskId !== "";

  const hasProjectId =
    projectId !== undefined && projectId !== null && projectId !== "";

  if (!hasTaskId && !hasProjectId) {
    throw serviceError("Task ID or project ID is required", 400);
  }

  if (hasTaskId && hasProjectId) {
    throw serviceError("Provide either a task ID or project ID, not both", 400);
  }

  let normalizedProjectId;

  /*
   * COMMENT ON TASK
   */
  if (hasTaskId) {
    const normalizedTaskId = Number(taskId);

    if (!Number.isInteger(normalizedTaskId) || normalizedTaskId <= 0) {
      throw serviceError("Invalid task ID", 400);
    }

    const taskResult = await pool.query(
      `
            SELECT project_id
            FROM tasks
            WHERE id = $1
            LIMIT 1
            `,
      [normalizedTaskId],
    );

    if (taskResult.rows.length === 0) {
      throw serviceError("Task not found or you are not a team member", 404);
    }

    normalizedProjectId = Number(taskResult.rows[0].project_id);
  }

  /*
   * COMMENT ON PROJECT
   */
  if (hasProjectId) {
    normalizedProjectId = Number(projectId);

    if (!Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
      throw serviceError("Invalid project ID", 400);
    }
  }

  /*
   * Verify workspace/team membership.
   */
  const project = await getProjectContext(normalizedProjectId);

  if (!project) {
    throw serviceError(
      hasTaskId
        ? "Task not found or you are not a team member"
        : "Project not found or you are not a team member",
      404,
    );
  }

  const hasAccess = await verifyProjectMembership(project, normalizedUserId);

  if (!hasAccess) {
    throw serviceError(
      hasTaskId
        ? "Task not found or you are not a team member"
        : "Project not found or you are not a team member",
      project.workspace_id ? 403 : 404,
    );
  }

  /*
   * Insert comment.
   */
  const result = await pool.query(
    `
        INSERT INTO comments (
            content,
            user_id,
            task_id,
            project_id
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
    [
      content.trim(),
      normalizedUserId,
      hasTaskId ? Number(taskId) : null,
      hasProjectId ? normalizedProjectId : null,
    ],
  );

  return result.rows[0];
}

module.exports = {
  createComment,
};
