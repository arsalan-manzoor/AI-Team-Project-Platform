const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Get all notifications for the logged-in user
router.get("/", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, user_id, title, message, is_read, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Notification fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Get unread notifications for the logged-in user
router.get("/unread", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, user_id, title, message, is_read, created_at
             FROM notifications
             WHERE user_id = $1
               AND is_read = FALSE
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Unread notification fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Mark all notifications as read
router.put("/read-all", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE user_id = $1
               AND is_read = FALSE`,
            [req.user.id]
        );

        res.json({
            message: "All notifications marked as read",
            updated: result.rowCount
        });
    } catch (error) {
        console.error("Notification read-all error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// Mark one notification as read
router.put("/:id/read", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE id = $1
               AND user_id = $2
             RETURNING id, user_id, title, message, is_read, created_at`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Notification not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Notification update error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});

module.exports = router;