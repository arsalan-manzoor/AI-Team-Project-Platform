const pool = require("../config/db");

async function getTaskListContext(userId) {
    const result = await pool.query(
        `SELECT tasks.*
         FROM tasks
         JOIN projects
            ON tasks.project_id = projects.id
         JOIN team_members
            ON projects.team_id = team_members.team_id
         WHERE team_members.user_id = $1
         ORDER BY tasks.created_at DESC`,
        [userId]
    );

    return {
        tasks: result.rows
    };
}

module.exports = {
    getTaskListContext
};