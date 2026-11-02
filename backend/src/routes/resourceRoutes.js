const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Create a resource
router.post("/", authMiddleware, async (req, res) => {
    const { name, description, url, projectId } = req.body;

    if (!name || !projectId) {
        return res.status(400).json({
            error: "Resource name and project ID are required"
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
            `INSERT INTO resources
             (name, description, url, project_id, uploaded_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                name,
                description || null,
                url || null,
                projectId,
                req.user.id
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Resource creation error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Get resources for a project
router.get("/project/:projectId", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT resources.id,
                    resources.name,
                    resources.description,
                    resources.url,
                    resources.project_id,
                    resources.uploaded_by,
                    users.name AS uploaded_by_name,
                    resources.created_at
             FROM resources
             JOIN users
                ON resources.uploaded_by = users.id
             JOIN projects
                ON resources.project_id = projects.id
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE resources.project_id = $1
               AND team_members.user_id = $2
             ORDER BY resources.id`,
            [req.params.projectId, req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Resource fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Update a resource
router.put("/:id", authMiddleware, async (req, res) => {
    const { name, description, url } = req.body;

    if (!name) {
        return res.status(400).json({
            error: "Resource name is required"
        });
    }

    try {
        const result = await pool.query(
            `UPDATE resources
             SET name = $1,
                 description = $2,
                 url = $3
             WHERE id = $4
               AND uploaded_by = $5
             RETURNING *`,
            [
                name,
                description || null,
                url || null,
                req.params.id,
                req.user.id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Resource not found or you are not the uploader"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Resource update error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Delete a resource
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM resources
             WHERE id = $1
               AND uploaded_by = $2
             RETURNING *`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Resource not found or you are not the uploader"
            });
        }

        res.json({
            message: "Resource deleted successfully",
            resource: result.rows[0]
        });
    } catch (error) {
        console.error("Resource deletion error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

module.exports = router;