const pool = require("../config/db");

async function createMilestone({
    name,
    description = null,
    projectId,
    deadline = null,
    status = "pending",
    userId
}) {
    if (!Number.isInteger(userId)) {
        throw new Error("Invalid user ID");
    }

    if (!name || !Number.isInteger(projectId)) {
        throw new Error(
            "Milestone name and project ID are required"
        );
    }

    const projectResult = await pool.query(
        `SELECT projects.id
         FROM projects
         JOIN team_members
            ON projects.team_id = team_members.team_id
         WHERE projects.id = $1
           AND team_members.user_id = $2`,
        [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
        throw new Error(
            "Project not found or you are not a team member"
        );
    }

    const result = await pool.query(
        `INSERT INTO milestones
         (name, description, project_id, deadline, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
            name,
            description || null,
            projectId,
            deadline || null,
            status || "pending"
        ]
    );

    return result.rows[0];
}

module.exports = {
    createMilestone
};