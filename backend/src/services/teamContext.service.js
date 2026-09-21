const pool = require("../config/db");

async function getTeamContext(teamId, userId) {
    const teamResult = await pool.query(
        `SELECT
            teams.id,
            teams.name,
            teams.description,
            teams.created_by,
            teams.created_at
         FROM teams
         JOIN team_members
            ON teams.id = team_members.team_id
         WHERE teams.id = $1
           AND team_members.user_id = $2`,
        [teamId, userId]
    );

    if (teamResult.rows.length === 0) {
        return null;
    }

    const membersResult = await pool.query(
        `SELECT
            users.id,
            users.name,
            users.email
         FROM users
         JOIN team_members
            ON users.id = team_members.user_id
         WHERE team_members.team_id = $1
         ORDER BY users.id`,
        [teamId]
    );

    const projectsResult = await pool.query(
        `SELECT
            id,
            name,
            description,
            created_by,
            created_at
         FROM projects
         WHERE team_id = $1
         ORDER BY id`,
        [teamId]
    );

    return {
        team: teamResult.rows[0],
        members: membersResult.rows,
        projects: projectsResult.rows
    };
}

module.exports = {
    getTeamContext
};