const pool = require("../config/db");

async function createComment({
    content,
    taskId,
    projectId,
    userId
}) {
    if (!content || typeof content !== "string") {
        throw new Error(
            "Comment content is required"
        );
    }

    if (!Number.isInteger(userId)) {
        throw new Error(
            "Authenticated user ID must be a valid integer"
        );
    }

    const hasTaskId =
        taskId !== undefined &&
        taskId !== null;

    const hasProjectId =
        projectId !== undefined &&
        projectId !== null;

    if (
        !hasTaskId &&
        !hasProjectId
    ) {
        throw new Error(
            "Task ID or project ID is required"
        );
    }

    if (
        hasTaskId &&
        hasProjectId
    ) {
        throw new Error(
            "Provide either a task ID or project ID, not both"
        );
    }

    // Check task access
    if (hasTaskId) {
        const taskResult = await pool.query(
            `SELECT tasks.id
             FROM tasks
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE tasks.id = $1
               AND team_members.user_id = $2`,
            [
                taskId,
                userId
            ]
        );

        if (taskResult.rows.length === 0) {
            throw new Error(
                "Task not found or you are not a team member"
            );
        }
    }

    // Check project access
    if (hasProjectId) {
        const projectResult = await pool.query(
            `SELECT projects.id
             FROM projects
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE projects.id = $1
               AND team_members.user_id = $2`,
            [
                projectId,
                userId
            ]
        );

        if (projectResult.rows.length === 0) {
            throw new Error(
                "Project not found or you are not a team member"
            );
        }
    }

    const result = await pool.query(
        `INSERT INTO comments
            (content, user_id, task_id, project_id)
         VALUES
            ($1, $2, $3, $4)
         RETURNING *`,
        [
            content,
            userId,
            hasTaskId ? taskId : null,
            hasProjectId ? projectId : null
        ]
    );

    return result.rows[0];
}

module.exports = {
    createComment
};