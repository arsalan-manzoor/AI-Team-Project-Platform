const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    createConversation,
    getConversation,
    getConversations,
    getMessages,
    deleteConversation
} = require("../services/aiConversation.service");

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
    try {
        const body = req.body || {};

        const {
            title = null
        } = body;

        if (
            title !== null &&
            typeof title !== "string"
        ) {
            return res.status(400).json({
                error:
                    "Conversation title must be a string"
            });
        }

        if (
            typeof title === "string" &&
            title.length > 255
        ) {
            return res.status(400).json({
                error:
                    "Conversation title must not exceed 255 characters"
            });
        }

        const conversation =
            await createConversation(
                req.user.id,
                title
            );

        res.status(201).json(
            conversation
        );
    } catch (error) {
        console.error(
            "AI conversation creation error:",
            error.message
        );

        res.status(500).json({
            error:
                "Failed to create AI conversation"
        });
    }
});

router.get("/", authMiddleware, async (req, res) => {
    try {
        const conversations =
            await getConversations(
                req.user.id
            );

        res.json(conversations);
    } catch (error) {
        console.error(
            "AI conversation list error:",
            error.message
        );

        res.status(500).json({
            error:
                "Failed to retrieve AI conversations"
        });
    }
});

router.get(
    "/:id",
    authMiddleware,
    async (req, res) => {
        try {
            const conversationId =
                Number(req.params.id);

            if (
                !Number.isInteger(
                    conversationId
                )
            ) {
                return res.status(400).json({
                    error:
                        "AI conversation ID must be a valid integer"
                });
            }

            const conversation =
                await getConversation(
                    conversationId,
                    req.user.id
                );

            if (!conversation) {
                return res.status(404).json({
                    error:
                        "AI conversation was not found"
                });
            }

            const messages =
                await getMessages(
                    conversationId,
                    req.user.id
                );

            res.json({
                conversation,
                messages: messages || []
            });
        } catch (error) {
            console.error(
                "AI conversation retrieval error:",
                error.message
            );

            res.status(500).json({
                error:
                    "Failed to retrieve AI conversation"
            });
        }
    }
);

router.delete(
    "/:id",
    authMiddleware,
    async (req, res) => {
        try {
            const conversationId =
                Number(req.params.id);

            if (
                !Number.isInteger(
                    conversationId
                )
            ) {
                return res.status(400).json({
                    error:
                        "AI conversation ID must be a valid integer"
                });
            }

            const conversation =
                await deleteConversation(
                    conversationId,
                    req.user.id
                );

            if (!conversation) {
                return res.status(404).json({
                    error:
                        "AI conversation was not found"
                });
            }

            res.json({
                message:
                    "AI conversation deleted successfully",
                conversation
            });
        } catch (error) {
            console.error(
                "AI conversation deletion error:",
                error.message
            );

            res.status(500).json({
                error:
                    "Failed to delete AI conversation"
            });
        }
    }
);

module.exports = router;