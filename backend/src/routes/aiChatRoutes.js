const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
    runAIRequest,
    validateMessages
} = require("../ai/aiOrchestrator");

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
    try {
        const body = req.body || {};
        const { messages } = body;

        validateMessages(messages);

        const result = await runAIRequest({
            messages,
            userId: req.user.id
        });

        res.json(result);
    } catch (error) {
        if (
            error.message ===
                "AI request messages must be an array" ||
            error.message ===
                "AI request must contain at least one message" ||
            error.message ===
                "Each AI message must be an object" ||
            error.message ===
                "AI message role is invalid" ||
            error.message ===
                "AI message content must be a string"
        ) {
            return res.status(400).json({
                error: error.message
            });
        }

        console.error(
            "AI chat error:",
            error.message
        );

        res.status(500).json({
            error: "Failed to process AI request"
        });
    }
});

module.exports = router;