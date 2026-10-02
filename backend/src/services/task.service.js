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


async function updateTask({
    taskId,
    title,
    description = null,
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

        const taskResult = await client.query(
            `SELECT tasks.id,
                    tasks.project_id,
                    tasks.assigned_to
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
            throw new Error(
                "Task not found"
            );
        }

        const projectId =
            taskResult.rows[0].project_id;

        const oldAssignedTo =
            taskResult.rows[0].assigned_to;

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
            `UPDATE tasks
             SET title = $1,
                 description = $2,
                 assigned_to = $3,
                 status = $4,
                 priority = $5,
                 deadline = $6
             WHERE id = $7
               AND created_by = $8
             RETURNING *`,
            [
                title,
                description,
                assignedTo,
                status,
                priority,
                deadline,
                taskId,
                userId
            ]
        );

        if (result.rows.length === 0) {
            throw new Error(
                "Task not found or you are not the creator"
            );
        }

        const newAssignedTo = assignedTo
            ? Number(assignedTo)
            : null;

        if (
            newAssignedTo &&
            newAssignedTo !== Number(oldAssignedTo)
        ) {
            await client.query(
                `INSERT INTO notifications
                 (user_id, title, message)
                 VALUES ($1, $2, $3)`,
                [
                    newAssignedTo,
                    "New Task Assigned",
                    `You have been assigned a new task: ${title}`
                ]
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


async function deleteTask({
    taskId,
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

        const taskResult = await client.query(
            `SELECT tasks.id
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
            throw new Error("Task not found");
        }

        const result = await client.query(
            `DELETE FROM tasks
             WHERE id = $1
               AND created_by = $2
             RETURNING *`,
            [taskId, userId]
        );

        if (result.rows.length === 0) {
            throw new Error(
                "Task not found or you are not the creator"
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


async function bulkUpdateTasks({
    taskIds,
    status,
    priority,
    assignedTo,
    deadline,
    userId
}) {
    if (!Number.isInteger(userId)) {
        throw new Error(
            "Authenticated user ID must be a valid integer"
        );
    }

    if (
        !Array.isArray(taskIds) ||
        taskIds.length === 0
    ) {
        throw new Error(
            "At least one task ID is required"
        );
    }

    const uniqueTaskIds = [
        ...new Set(
            taskIds.map(Number)
        )
    ];

    if (
        uniqueTaskIds.some(
            (taskId) =>
                !Number.isInteger(taskId)
        )
    ) {
        throw new Error(
            "All task IDs must be valid integers"
        );
    }

    const hasUpdate =
        status !== undefined ||
        priority !== undefined ||
        assignedTo !== undefined ||
        deadline !== undefined;

    if (!hasUpdate) {
        throw new Error(
            "At least one task field must be provided for update"
        );
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const taskResult = await client.query(
            `SELECT tasks.id,
                    tasks.project_id,
                    tasks.created_by,
                    tasks.assigned_to
             FROM tasks
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE tasks.id = ANY($1::int[])
               AND team_members.user_id = $2`,
            [uniqueTaskIds, userId]
        );

        if (
            taskResult.rows.length !==
            uniqueTaskIds.length
        ) {
            throw new Error(
                "One or more tasks were not found or you are not authorized to update them"
            );
        }

        const unauthorizedTask =
            taskResult.rows.find(
                (task) =>
                    Number(task.created_by) !==
                    Number(userId)
            );

        if (unauthorizedTask) {
            throw new Error(
                "You are not the creator of one or more selected tasks"
            );
        }

        if (assignedTo !== undefined) {
            if (
                assignedTo !== null &&
                !Number.isInteger(
                    Number(assignedTo)
                )
            ) {
                throw new Error(
                    "Assigned user must be a valid integer or null"
                );
            }

            if (assignedTo !== null) {
                const projectIds = [
                    ...new Set(
                        taskResult.rows.map(
                            (task) =>
                                Number(
                                    task.project_id
                                )
                        )
                    )
                ];

                const memberResult =
                    await client.query(
                        `SELECT DISTINCT
                                projects.id AS project_id
                         FROM projects
                         JOIN team_members
                            ON projects.team_id =
                               team_members.team_id
                         WHERE projects.id =
                               ANY($1::int[])
                           AND team_members.user_id = $2
                           AND team_members.user_id = $3`,
                        [
                            projectIds,
                            userId,
                            Number(assignedTo)
                        ]
                    );

                if (
                    memberResult.rows.length !==
                    projectIds.length
                ) {
                    throw new Error(
                        "Assigned user is not a member of every selected project team"
                    );
                }
            }
        }

        const result =
            await client.query(
                `UPDATE tasks
                 SET status =
                        COALESCE($1, status),
                     priority =
                        COALESCE($2, priority),
                     assigned_to =
                        CASE
                            WHEN $3::int IS NULL
                                THEN assigned_to
                            ELSE $3::int
                        END,
                     deadline =
                        CASE
                            WHEN $4::timestamp IS NULL
                                THEN deadline
                            ELSE $4::timestamp
                        END
                 WHERE id = ANY($5::int[])
                   AND created_by = $6
                 RETURNING *`,
                [
                    status ?? null,
                    priority ?? null,
                    assignedTo ?? null,
                    deadline ?? null,
                    uniqueTaskIds,
                    userId
                ]
            );

        if (
            result.rows.length !==
            uniqueTaskIds.length
        ) {
            throw new Error(
                "Bulk task update could not be completed"
            );
        }

        if (assignedTo !== undefined && assignedTo !== null) {
            for (const task of result.rows) {
                if (
                    Number(task.assigned_to) !==
                    Number(userId)
                ) {
                    await client.query(
                        `INSERT INTO notifications
                         (user_id, title, message)
                         VALUES ($1, $2, $3)`,
                        [
                            Number(assignedTo),
                            "Tasks Updated",
                            `You have been assigned task #${task.id}`
                        ]
                    );
                }
            }
        }

        await client.query("COMMIT");

        return result.rows;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}


module.exports = {
    createTask,
    updateTask,
    deleteTask,
    bulkUpdateTasks
};