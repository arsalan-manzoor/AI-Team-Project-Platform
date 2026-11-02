const pool = require("../config/db");

async function getTeamListContext(userId) {
    const result = await pool.query(
        `SELECT
            teams.id,
            teams.name,
            teams.description,
            teams.created_by,
            teams.created_at
         FROM teams
         JOIN team_members
            ON teams.id = team_members.team_id
         WHERE team_members.user_id = $1
         ORDER BY teams.created_at DESC`,
        [userId]
    );

    return {
        teams: result.rows
    };
}

module.exports = {
    getTeamListContext
};