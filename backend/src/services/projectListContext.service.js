const pool = require("../config/db");

async function getProjectListContext(userId) {
    const result = await pool.query(
        `SELECT projects.id,
                projects.name,
                projects.description,
                projects.team_id,
                projects.created_by,
                projects.created_at
         FROM projects
         JOIN team_members
            ON projects.team_id = team_members.team_id
         WHERE team_members.user_id = $1
         ORDER BY projects.created_at DESC`,
        [userId]
    );

    return {
        projects: result.rows
    };
}

module.exports = {
    getProjectListContext
};