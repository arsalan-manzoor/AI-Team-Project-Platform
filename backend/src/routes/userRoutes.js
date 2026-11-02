const bcrypt = require("bcrypt");
const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(express.json());

// Get all users
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name, email, created_at FROM users"
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Database error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Create a user
router.post("/", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            error: "Name, email and password are required"
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (name, email, password)
             VALUES ($1, $2, $3)
             RETURNING id, name, email, created_at`,
            [name, email, hashedPassword]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Database error:", error.message);

        if (error.code === "23505") {
            return res.status(409).json({
                error: "Email already exists"
            });
        }

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Update logged-in user's profile
router.put("/:id", authMiddleware, async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email) {
        return res.status(400).json({
            error: "Name and email are required"
        });
    }

    try {
        if (req.user.id !== Number(req.params.id)) {
            return res.status(403).json({
                error: "You can only update your own profile"
            });
        }

        let result;

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);

            result = await pool.query(
                `UPDATE users
                 SET name = $1, email = $2, password = $3
                 WHERE id = $4
                 RETURNING id, name, email, created_at`,
                [name, email, hashedPassword, req.user.id]
            );
        } else {
            result = await pool.query(
                `UPDATE users
                 SET name = $1, email = $2
                 WHERE id = $3
                 RETURNING id, name, email, created_at`,
                [name, email, req.user.id]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        res.json({
            message: "Profile updated successfully",
            user: result.rows[0]
        });
    } catch (error) {
        console.error("Profile update error:", error.message);

        if (error.code === "23505") {
            return res.status(409).json({
                error: "Email already exists"
            });
        }

        res.status(500).json({
            error: "Database error"
        });
    }
});

module.exports = router;