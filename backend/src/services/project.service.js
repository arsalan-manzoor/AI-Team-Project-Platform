const pool = require("../config/db");

async function createProject({
    name,
    description = null,
    teamId,
    userId
}) {
    if (!Number.isInteger(userId)) {
        throw new Error("Invalid user ID");
    }

    if (!name || !Number.isInteger(teamId)) {
        throw new Error("Project name and team ID are required");
    }

    const teamResult = await pool.query(
        `SELECT team_members.team_id
         FROM team_members
         WHERE team_members.team_id = $1
           AND team_members.user_id = $2`,
        [teamId, userId]
    );

    if (teamResult.rows.length === 0) {
        throw new Error("You are not a member of this team");
    }

    const result = await pool.query(
        `INSERT INTO projects
         (name, description, team_id, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
            name,
            description || null,
            teamId,
            userId
        ]
    );

    return result.rows[0];
}

async function updateProject({
    projectId,
    name,
    description = null,
    userId
}) {
    if (!Number.isInteger(userId)) {
        throw new Error("Invalid user ID");
    }

    if (!Number.isInteger(projectId)) {
        throw new Error("Invalid project ID");
    }

    if (!name) {
        throw new Error("Project name is required");
    }

    const result = await pool.query(
        `UPDATE projects
         SET name = $1,
             description = $2
         WHERE id = $3
           AND created_by = $4
         RETURNING *`,
        [
            name,
            description || null,
            projectId,
            userId
        ]
    );

    if (result.rows.length === 0) {
        throw new Error(
            "Project not found or you are not the creator"
        );
    }

    return result.rows[0];
}

async function deleteProject({
    projectId,
    userId
}) {
    if (!Number.isInteger(userId)) {
        throw new Error("Invalid user ID");
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const projectResult = await client.query(
            `SELECT projects.id
             FROM projects
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE projects.id = $1
               AND team_members.user_id = $2`,
            [projectId, userId]
        );

        if (projectResult.rows.length === 0) {
            throw new Error("Project not found");
        }

        const result = await client.query(
            `DELETE FROM projects
             WHERE id = $1
               AND created_by = $2
             RETURNING *`,
            [projectId, userId]
        );

        if (result.rows.length === 0) {
            throw new Error(
                "Project not found or you are not the creator"
            );
        }

        await client.query("COMMIT");

        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    createProject,
    updateProject,
    deleteProject
};