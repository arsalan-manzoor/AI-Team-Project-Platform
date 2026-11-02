const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Create a comment
router.post("/", authMiddleware, async (req, res) => {
    const { content, taskId, projectId } = req.body;

    if (!content || (!taskId && !projectId)) {
        return res.status(400).json({
            error: "Comment content and task ID or project ID are required"
        });
    }

    try {
        // Check task access
        if (taskId) {
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
        }

        // Check project access
        if (projectId) {
            const projectResult = await pool.query(
                `SELECT projects.id
                 FROM projects
                 JOIN team_members
                    ON projects.team_id = team_members.team_id
                 WHERE projects.id = $1
                   AND team_members.user_id = $2`,
                [projectId, req.user.id]
            );

            if (projectResult.rows.length === 0) {
                return res.status(404).json({
                    error: "Project not found or you are not a team member"
                });
            }
        }

        const result = await pool.query(
            `INSERT INTO comments (content, user_id, task_id, project_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [
                content,
                req.user.id,
                taskId || null,
                projectId || null
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Comment creation error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Get comments for a task
router.get("/task/:taskId", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT comments.id, comments.content,
                    comments.user_id, users.name AS user_name,
                    comments.task_id, comments.created_at
             FROM comments
             JOIN users
                ON comments.user_id = users.id
             JOIN tasks
                ON comments.task_id = tasks.id
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE comments.task_id = $1
               AND team_members.user_id = $2
             ORDER BY comments.id`,
            [req.params.taskId, req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Comment fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Get comments for a project
router.get("/project/:projectId", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT comments.id, comments.content,
                    comments.user_id, users.name AS user_name,
                    comments.project_id, comments.created_at
             FROM comments
             JOIN users
                ON comments.user_id = users.id
             JOIN projects
                ON comments.project_id = projects.id
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE comments.project_id = $1
               AND team_members.user_id = $2
             ORDER BY comments.id`,
            [req.params.projectId, req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Comment fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Update a comment
router.put("/:id", authMiddleware, async (req, res) => {
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({
            error: "Comment content is required"
        });
    }

    try {
        const result = await pool.query(
            `UPDATE comments
             SET content = $1
             WHERE id = $2
               AND user_id = $3
             RETURNING *`,
            [content, req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Comment not found or you are not the author"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Comment update error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Delete a comment
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM comments
             WHERE id = $1
               AND user_id = $2
             RETURNING *`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Comment not found or you are not the author"
            });
        }

        res.json({
            message: "Comment deleted successfully",
            comment: result.rows[0]
        });
    } catch (error) {
        console.error("Comment deletion error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

module.exports = router;