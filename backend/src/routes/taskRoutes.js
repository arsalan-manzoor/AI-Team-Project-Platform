const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(express.json());


// CREATE TASK
router.post("/", authMiddleware, async (req, res) => {
    const {
        title,
        description,
        projectId,
        assignedTo,
        status,
        priority,
        deadline
    } = req.body;

    if (!title || !projectId) {
        return res.status(400).json({
            error: "Task title and project ID are required"
        });
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
            [projectId, req.user.id]
        );

        if (projectResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "Project not found or you are not a team member"
            });
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
                await client.query("ROLLBACK");

                return res.status(400).json({
                    error: "Assigned user is not a member of the project team"
                });
            }
        }

        const result = await client.query(
            `INSERT INTO tasks
             (title, description, project_id, assigned_to, created_by, status, priority, deadline)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                title,
                description || null,
                projectId,
                assignedTo || null,
                req.user.id,
                status || "pending",
                priority || "medium",
                deadline || null
            ]
        );

        const task = result.rows[0];

        if (
            assignedTo &&
            Number(assignedTo) !== Number(req.user.id)
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

        res.status(201).json(task);
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Task creation error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    } finally {
        client.release();
    }
});


// GET ALL TASKS
router.get("/", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT tasks.*
             FROM tasks
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE team_members.user_id = $1
             ORDER BY tasks.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Task fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});


// GET SINGLE TASK
router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT tasks.*
             FROM tasks
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE tasks.id = $1
               AND team_members.user_id = $2`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Task not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Task fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});


// UPDATE TASK
router.put("/:id", authMiddleware, async (req, res) => {
    const {
        title,
        description,
        assignedTo,
        status,
        priority,
        deadline
    } = req.body;

    if (!title) {
        return res.status(400).json({
            error: "Task title is required"
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const taskResult = await client.query(
            `SELECT tasks.id, tasks.project_id, tasks.assigned_to
             FROM tasks
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE tasks.id = $1
               AND team_members.user_id = $2`,
            [req.params.id, req.user.id]
        );

        if (taskResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "Task not found"
            });
        }

        const projectId = taskResult.rows[0].project_id;
        const oldAssignedTo = taskResult.rows[0].assigned_to;

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
                await client.query("ROLLBACK");

                return res.status(400).json({
                    error: "Assigned user is not a member of the project team"
                });
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
                description || null,
                assignedTo || null,
                status || "pending",
                priority || "medium",
                deadline || null,
                req.params.id,
                req.user.id
            ]
        );

        if (result.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "Task not found or you are not the creator"
            });
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

        res.json(result.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Task update error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    } finally {
        client.release();
    }
});


// DELETE TASK
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM tasks
             WHERE id = $1
               AND created_by = $2
             RETURNING *`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Task not found or you are not the creator"
            });
        }

        res.json({
            message: "Task deleted successfully",
            task: result.rows[0]
        });
    } catch (error) {
        console.error("Task deletion error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});


module.exports = router;