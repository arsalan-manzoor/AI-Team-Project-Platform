const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getAIContext } = require("../services/aiContext.service");

const router = express.Router();

router.get("/:type", authMiddleware, async (req, res) => {
    try {
        const { type } = req.params;
        const id = req.query.id ? Number(req.query.id) : null;

        if (
            type !== "user_tasks" &&
            id === null
        ) {
            return res.status(400).json({
                error: "Context ID is required"
            });
        }

        const context = await getAIContext(
            type,
            id,
            req.user.id
        );

        res.json(context);
    } catch (error) {
        if (error.message === "Invalid AI context type") {
            return res.status(400).json({
                error: error.message
            });
        }

        console.error("AI context error:", error.message);

        res.status(500).json({
            error: "Failed to load AI context"
        });
    }
});

module.exports = router;