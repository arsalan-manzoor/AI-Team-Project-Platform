const pool = require("../config/db");

async function getUserTaskContext(userId) {
    const result = await pool.query(
        `SELECT
            tasks.id,
            tasks.title,
            tasks.status,
            tasks.priority,
            tasks.deadline,
            projects.id AS project_id,
            projects.name AS project_name
         FROM tasks
         JOIN projects
            ON tasks.project_id = projects.id
         JOIN team_members
            ON projects.team_id = team_members.team_id
         WHERE tasks.assigned_to = $1
           AND team_members.user_id = $1
         ORDER BY tasks.deadline ASC NULLS LAST`,
        [userId]
    );

    return {
        user: {
            id: userId
        },
        tasks: result.rows
    };
}

module.exports = {
    getUserTaskContext
};