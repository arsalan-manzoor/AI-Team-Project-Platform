const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Create a milestone
router.post("/", authMiddleware, async (req, res) => {
    const { name, description, projectId, deadline, status } = req.body;

    if (!name || !projectId) {
        return res.status(400).json({
            error: "Milestone name and project ID are required"
        });
    }

    try {
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

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Milestone creation error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Get milestones for a project
router.get("/project/:projectId", authMiddleware, async (req, res) => {
    try {
        const projectResult = await pool.query(
            `SELECT projects.id
             FROM projects
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE projects.id = $1
               AND team_members.user_id = $2`,
            [req.params.projectId, req.user.id]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                error: "Project not found or you are not a team member"
            });
        }

        const result = await pool.query(
            `SELECT id, name, description, project_id,
                    deadline, status, created_at
             FROM milestones
             WHERE project_id = $1
             ORDER BY id`,
            [req.params.projectId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Milestone fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Update a milestone
router.put("/:id", authMiddleware, async (req, res) => {
    const { name, description, deadline, status } = req.body;

    if (!name) {
        return res.status(400).json({
            error: "Milestone name is required"
        });
    }

    try {
        const result = await pool.query(
            `UPDATE milestones
             SET name = $1,
                 description = $2,
                 deadline = $3,
                 status = $4
             WHERE id = $5
               AND project_id IN (
                   SELECT projects.id
                   FROM projects
                   JOIN team_members
                      ON projects.team_id = team_members.team_id
                   WHERE team_members.user_id = $6
               )
             RETURNING *`,
            [
                name,
                description || null,
                deadline || null,
                status || "pending",
                req.params.id,
                req.user.id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Milestone not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Milestone update error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Delete a milestone
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM milestones
             WHERE id = $1
               AND project_id IN (
                   SELECT projects.id
                   FROM projects
                   JOIN team_members
                      ON projects.team_id = team_members.team_id
                   WHERE team_members.user_id = $2
               )
             RETURNING *`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Milestone not found"
            });
        }

        res.json({
            message: "Milestone deleted successfully",
            milestone: result.rows[0]
        });
    } catch (error) {
        console.error("Milestone deletion error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

module.exports = router;