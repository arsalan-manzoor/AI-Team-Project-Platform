const pool = require("../config/db");

async function createTask({
    title,
    description = null,
    projectId,
    assignedTo = null,
    status = "pending",
    priority = "medium",
    deadline = null,
    userId
}) {
    if (!Number.isInteger(userId)) {
        throw new Error(
            "Authenticated user ID must be a valid integer"
        );
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
            throw new Error(
                "Project not found or you are not a team member"
            );
        }

        if (assignedTo) {
            const memberResult = await client.query(
                `SELECT team_members.user_id
                 FROM team_members
                 JOIN projects
                    ON team_members.team_id = projects.team_id
                 WHERE projects.id = $1
                   AND team_members.user_id = $2`,
                [projectId, assignedTo]
            );

            if (memberResult.rows.length === 0) {
                throw new Error(
                    "Assigned user is not a member of the project team"
                );
            }
        }

        const result = await client.query(
            `INSERT INTO tasks
             (title, description, project_id, assigned_to, created_by,
              status, priority, deadline)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                title,
                description,
                projectId,
                assignedTo,
                userId,
                status,
                priority,
                deadline
            ]
        );

        const task = result.rows[0];

        if (
            assignedTo &&
            Number(assignedTo) !== Number(userId)
        ) {
            await client.query(
                `INSERT INTO notifications
                 (user_id, title, message)
                 VALUES ($1, $2, $3)`,
                [
                    assignedTo,
                    "New Task Assigned",
                    `You have been assigned a new task: ${title}`
                ]
            );
        }

        await client.query("COMMIT");

        return task;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    createTask
};