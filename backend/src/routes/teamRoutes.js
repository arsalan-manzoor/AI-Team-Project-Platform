const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Create a team
router.post("/", authMiddleware, async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({
            error: "Team name is required"
        });
    }

    try {
        const teamResult = await pool.query(
            "INSERT INTO teams (name, description, created_by) VALUES ($1, $2, $3) RETURNING *",
            [name, description || null, req.user.id]
        );

        const team = teamResult.rows[0];

        await pool.query(
            "INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)",
            [team.id, req.user.id]
        );

        res.status(201).json(team);
    } catch (error) {
        console.error("Team creation error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Get teams of logged-in user
router.get("/", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT teams.id, teams.name, teams.description,
                    teams.created_by, teams.created_at
             FROM teams
             JOIN team_members
                ON teams.id = team_members.team_id
             WHERE team_members.user_id = $1`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Team fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Get one team
router.get("/:teamId", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT teams.id, teams.name, teams.description,
                    teams.created_by, teams.created_at
             FROM teams
             JOIN team_members
                ON teams.id = team_members.team_id
             WHERE teams.id = $1
               AND team_members.user_id = $2`,
            [req.params.teamId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Team not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Team fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Update a team
router.put("/:teamId", authMiddleware, async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({
            error: "Team name is required"
        });
    }

    try {
        const result = await pool.query(
            `UPDATE teams
             SET name = $1, description = $2
             WHERE id = $3
               AND created_by = $4
             RETURNING *`,
            [
                name,
                description || null,
                req.params.teamId,
                req.user.id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Team not found or you are not the creator"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Team update error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Delete a team
router.delete("/:teamId", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM teams
             WHERE id = $1
               AND created_by = $2
             RETURNING *`,
            [req.params.teamId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Team not found or you are not the creator"
            });
        }

        res.json({
            message: "Team deleted successfully",
            team: result.rows[0]
        });
    } catch (error) {
        console.error("Team deletion error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Add a member to a team
// Only the team creator can add members
router.post("/:teamId/members", authMiddleware, async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({
            error: "User ID is required"
        });
    }

    try {
        const teamResult = await pool.query(
            "SELECT id FROM teams WHERE id = $1 AND created_by = $2",
            [req.params.teamId, req.user.id]
        );

        if (teamResult.rows.length === 0) {
            return res.status(403).json({
                error: "Only the team creator can add members"
            });
        }

        const result = await pool.query(
            "INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) RETURNING *",
            [req.params.teamId, userId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Add member error:", error.message);

        if (error.code === "23505") {
            return res.status(409).json({
                error: "User is already a member of this team"
            });
        }

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

// Remove a member from a team
// Only the team creator can remove members
router.delete("/:teamId/members/:userId", authMiddleware, async (req, res) => {
    try {
        const teamResult = await pool.query(
            "SELECT id FROM teams WHERE id = $1 AND created_by = $2",
            [req.params.teamId, req.user.id]
        );

        if (teamResult.rows.length === 0) {
            return res.status(403).json({
                error: "Only the team creator can remove members"
            });
        }

        const result = await pool.query(
            "DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 RETURNING *",
            [req.params.teamId, req.params.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Team member not found"
            });
        }

        res.json({
            message: "Team member removed successfully",
            member: result.rows[0]
        });
    } catch (error) {
        console.error("Remove member error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Get team members
router.get("/:teamId/members", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT users.id, users.name, users.email, team_members.joined_at
             FROM team_members
             JOIN users ON team_members.user_id = users.id
             WHERE team_members.team_id = $1`,
            [req.params.teamId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Team members fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

module.exports = router;