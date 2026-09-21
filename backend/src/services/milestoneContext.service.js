const pool = require("../config/db");

async function getMilestoneContext(milestoneId, userId) {
    const milestoneResult = await pool.query(
        `SELECT
            milestones.id,
            milestones.name,
            milestones.description,
            milestones.project_id,
            milestones.deadline,
            milestones.status,
            milestones.created_at,
            projects.name AS project_name
         FROM milestones
         JOIN projects
            ON milestones.project_id = projects.id
         JOIN team_members
            ON projects.team_id = team_members.team_id
         WHERE milestones.id = $1
           AND team_members.user_id = $2`,
        [milestoneId, userId]
    );

    if (milestoneResult.rows.length === 0) {
        return null;
    }

    const tasksResult = await pool.query(
        `SELECT
            id,
            title,
            status,
            priority,
            deadline,
            assigned_to
         FROM tasks
         WHERE project_id = $1
         ORDER BY deadline ASC NULLS LAST`,
        [milestoneResult.rows[0].project_id]
    );

    return {
        milestone: milestoneResult.rows[0],
        related_tasks: tasksResult.rows
    };
}

module.exports = {
    getMilestoneContext
};