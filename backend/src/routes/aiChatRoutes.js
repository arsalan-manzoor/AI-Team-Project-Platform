const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    runAIRequest,
    validateClientMessages
} = require("../ai/aiOrchestrator");

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
    try {
        const body = req.body || {};

        const {
            messages,
            conversationId = null
        } = body;

        validateClientMessages(messages);

        if (
            conversationId !== null &&
            !Number.isInteger(conversationId)
        ) {
            return res.status(400).json({
                error:
                    "AI conversation ID must be a valid integer"
            });
        }

        const result =
            await runAIRequest({
                messages,
                userId: req.user.id,
                conversationId
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
                "AI message content must be a string" ||
            error.message ===
                "Client AI messages must use the user role" ||
            error.message ===
                "AI conversation ID must be a valid integer"
        ) {
            return res.status(400).json({
                error: error.message
            });
        }

        if (
            error.message ===
            "AI conversation was not found"
        ) {
            return res.status(404).json({
                error: error.message
            });
        }

        if (
            error.message ===
            "Authenticated user ID must be a valid integer"
        ) {
            return res.status(401).json({
                error: error.message
            });
        }

        console.error(
            "AI chat error:",
            error.message
        );

        res.status(500).json({
            error:
                "Failed to process AI request"
        });
    }
});

module.exports = router;