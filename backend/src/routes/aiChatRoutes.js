const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { runAIRequest } = require("../ai/aiOrchestrator");

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
    try {
        const body = req.body || {};
        const { messages } = body;

        if (!Array.isArray(messages)) {
            return res.status(400).json({
                error: "Messages must be an array"
            });
        }

        if (messages.length === 0) {
            return res.status(400).json({
                error: "At least one message is required"
            });
        }

        const result = await runAIRequest({
            messages,
            userId: req.user.id
        });

        res.json(result);
    } catch (error) {
        console.error("AI chat error:", error.message);

        res.status(500).json({
            error: "Failed to process AI request"
        });
    }
});

module.exports = router;