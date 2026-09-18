const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
    const { name, description, teamId } = req.body;

    if (!name || !teamId) {
        return res.status(400).json({
            error: "Project name and team ID are required"
        });
    }

    try {
    const teamResult = await pool.query(
        `SELECT team_members.team_id
         FROM team_members
         WHERE team_members.team_id = $1
           AND team_members.user_id = $2`,
        [teamId, req.user.id]
    );

    if (teamResult.rows.length === 0) {
        return res.status(403).json({
            error: "You are not a member of this team"
        });
    }

    const result = await pool.query(
        `INSERT INTO projects (name, description, team_id, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, description || null, teamId, req.user.id]
    );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Project creation error:", error.message);

        if (error.code === "23503") {
            return res.status(404).json({
                error: "Team or user not found"
            });
        }

        res.status(500).json({
            error: "Database error"
        });
    }
});

router.get("/", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT projects.id, projects.name, projects.description,
                    projects.team_id, projects.created_by, projects.created_at
             FROM projects
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE team_members.user_id = $1`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Project fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT projects.id, projects.name, projects.description,
                    projects.team_id, projects.created_by, projects.created_at
             FROM projects
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE projects.id = $1
               AND team_members.user_id = $2`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Project not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Project fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});
router.put("/:id", authMiddleware, async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({
            error: "Project name is required"
        });
    }

    try {
        const result = await pool.query(
            `UPDATE projects
             SET name = $1, description = $2
             WHERE id = $3
               AND created_by = $4
             RETURNING *`,
            [name, description || null, req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Project not found or you are not the creator"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Project update error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM projects
             WHERE id = $1
               AND created_by = $2
             RETURNING *`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Project not found or you are not the creator"
            });
        }

        res.json({
            message: "Project deleted successfully",
            project: result.rows[0]
        });
    } catch (error) {
        console.error("Project deletion error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});
module.exports = router;