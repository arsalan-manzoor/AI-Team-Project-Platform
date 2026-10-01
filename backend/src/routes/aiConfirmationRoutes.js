const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    getConfirmation,
    deleteConfirmation
} = require("../services/aiConfirmation.service");

const {
    createTask
} = require("../services/task.service");

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
    try {
        const body = req.body || {};

        const {
            confirmationId
        } = body;

        if (
            typeof confirmationId !== "string" ||
            confirmationId.length === 0
        ) {
            return res.status(400).json({
                error:
                    "Confirmation ID is required"
            });
        }

        const confirmation =
            getConfirmation(
                confirmationId,
                req.user.id
            );

        if (!confirmation) {
            return res.status(404).json({
                error:
                    "Confirmation was not found, has expired, or has already been used"
            });
        }

        if (
            confirmation.toolName !==
            "create_task"
        ) {
            return res.status(400).json({
                error:
                    "Unsupported AI write action"
            });
        }

        const args =
            confirmation.toolArguments || {};

        const task =
            await createTask({
                title: args.title,
                description:
                    args.description || null,
                projectId:
                    args.project_id,
                assignedTo:
                    args.assigned_to || null,
                status:
                    args.status || "pending",
                priority:
                    args.priority || "medium",
                deadline:
                    args.deadline || null,
                userId:
                    req.user.id
            });

        deleteConfirmation(
            confirmationId,
            req.user.id
        );

        return res.status(201).json({
            message:
                "AI action confirmed and executed successfully",
            task
        });
    } catch (error) {
        if (
            error.message ===
            "Authenticated user ID must be a valid integer"
        ) {
            return res.status(401).json({
                error: error.message
            });
        }

        if (
            error.message ===
                "Project not found or you are not a team member" ||
            error.message ===
                "Assigned user is not a member of the project team"
        ) {
            return res.status(403).json({
                error: error.message
            });
        }

        console.error(
            "AI confirmation execution error:",
            error.message
        );

        return res.status(500).json({
            error:
                "Failed to execute confirmed AI action"
        });
    }
});

module.exports = router;