const pool = require("../config/db");

async function getTaskContext(taskId, userId) {
    const taskResult = await pool.query(
        `SELECT
            tasks.id,
            tasks.title,
            tasks.description,
            tasks.status,
            tasks.priority,
            tasks.deadline,
            tasks.assigned_to,
            tasks.created_by,
            projects.id AS project_id,
            projects.name AS project_name
         FROM tasks
         JOIN projects
            ON tasks.project_id = projects.id
         JOIN team_members
            ON projects.team_id = team_members.team_id
         WHERE tasks.id = $1
           AND team_members.user_id = $2`,
        [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
        return null;
    }

    const subtasksResult = await pool.query(
        `SELECT
            id,
            title,
            task_id,
            status,
            created_at
         FROM subtasks
         WHERE task_id = $1
         ORDER BY id`,
        [taskId]
    );

    const commentsResult = await pool.query(
        `SELECT
            comments.id,
            comments.content,
            comments.user_id,
            users.name AS user_name,
            comments.task_id,
            comments.created_at
         FROM comments
         JOIN users
            ON comments.user_id = users.id
         WHERE comments.task_id = $1
         ORDER BY comments.id`,
        [taskId]
    );

    return {
        task: taskResult.rows[0],
        subtasks: subtasksResult.rows,
        comments: commentsResult.rows
    };
}

module.exports = {
    getTaskContext
};