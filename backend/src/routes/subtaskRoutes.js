const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Create a subtask
router.post("/", authMiddleware, async (req, res) => {
    const { title, taskId, status } = req.body;

    if (!title || !taskId) {
        return res.status(400).json({
            error: "Subtask title and task ID are required"
        });
    }

    try {
        const taskResult = await pool.query(
            `SELECT tasks.id
             FROM tasks
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE tasks.id = $1
               AND team_members.user_id = $2`,
            [taskId, req.user.id]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({
                error: "Task not found or you are not a team member"
            });
        }

        const result = await pool.query(
            `INSERT INTO subtasks (title, task_id, status)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [title, taskId, status || "pending"]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Subtask creation error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Get subtasks for a task
router.get("/task/:taskId", authMiddleware, async (req, res) => {
    try {
        const taskResult = await pool.query(
            `SELECT tasks.id
             FROM tasks
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE tasks.id = $1
               AND team_members.user_id = $2`,
            [req.params.taskId, req.user.id]
        );

        if (taskResult.rows.length === 0) {
            return res.status(404).json({
                error: "Task not found or you are not a team member"
            });
        }

        const result = await pool.query(
            `SELECT id, title, task_id, status, created_at
             FROM subtasks
             WHERE task_id = $1
             ORDER BY id`,
            [req.params.taskId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Subtask fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Update a subtask
router.put("/:id", authMiddleware, async (req, res) => {
    const { title, status } = req.body;

    if (!title) {
        return res.status(400).json({
            error: "Subtask title is required"
        });
    }

    try {
        const result = await pool.query(
            `UPDATE subtasks
             SET title = $1, status = $2
             WHERE id = $3
               AND task_id IN (
                   SELECT tasks.id
                   FROM tasks
                   JOIN projects
                      ON tasks.project_id = projects.id
                   JOIN team_members
                      ON projects.team_id = team_members.team_id
                   WHERE team_members.user_id = $4
               )
             RETURNING *`,
            [title, status || "pending", req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Subtask not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Subtask update error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Delete a subtask
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM subtasks
             WHERE id = $1
               AND task_id IN (
                   SELECT tasks.id
                   FROM tasks
                   JOIN projects
                      ON tasks.project_id = projects.id
                   JOIN team_members
                      ON projects.team_id = team_members.team_id
                   WHERE team_members.user_id = $2
               )
             RETURNING *`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Subtask not found"
            });
        }

        res.json({
            message: "Subtask deleted successfully",
            subtask: result.rows[0]
        });
    } catch (error) {
        console.error("Subtask deletion error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

module.exports = router;