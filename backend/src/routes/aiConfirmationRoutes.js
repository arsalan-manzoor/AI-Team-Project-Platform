const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    getConfirmation,
    deleteConfirmation
} = require("../services/aiConfirmation.service");

const {
    createTask,
    updateTask,
    deleteTask,
    bulkUpdateTasks
} = require("../services/task.service");

const {
    createProject,
    deleteProject
} = require("../services/project.service");

const {
    createMilestone
} = require("../services/milestone.service");

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

        const args =
            confirmation.toolArguments || {};

        // CREATE TASK
        if (
            confirmation.toolName ===
            "create_task"
        ) {
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
        }

        // UPDATE TASK
        if (
            confirmation.toolName ===
            "update_task"
        ) {
            const task =
                await updateTask({
                    taskId:
                        args.task_id,
                    title:
                        args.title,
                    description:
                        args.description || null,
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

            return res.status(200).json({
                message:
                    "AI action confirmed and executed successfully",
                task
            });
        }

        // CREATE PROJECT
        if (
            confirmation.toolName ===
            "create_project"
        ) {
            const project =
                await createProject({
                    name:
                        args.name,
                    description:
                        args.description || null,
                    teamId:
                        args.team_id,
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
                project
            });
        }

        // CREATE MILESTONE
        if (
            confirmation.toolName ===
            "create_milestone"
        ) {
            const milestone =
                await createMilestone({
                    name:
                        args.name,
                    description:
                        args.description || null,
                    projectId:
                        args.project_id,
                    deadline:
                        args.deadline || null,
                    status:
                        args.status || "pending",
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
                milestone
            });
        }

        // DELETE TASK
        if (
            confirmation.toolName ===
            "delete_task"
        ) {
            const task =
                await deleteTask({
                    taskId:
                        args.task_id,
                    userId:
                        req.user.id
                });

            deleteConfirmation(
                confirmationId,
                req.user.id
            );

            return res.status(200).json({
                message:
                    "AI action confirmed and executed successfully",
                task
            });
        }

        // DELETE PROJECT
        if (
            confirmation.toolName ===
            "delete_project"
        ) {
            const project =
                await deleteProject({
                    projectId:
                        args.project_id,
                    userId:
                        req.user.id
                });

            deleteConfirmation(
                confirmationId,
                req.user.id
            );

            return res.status(200).json({
                message:
                    "AI action confirmed and executed successfully",
                project
            });
        }

        // BULK UPDATE TASKS
        if (
            confirmation.toolName ===
            "bulk_update_tasks"
        ) {
            const tasks =
                await bulkUpdateTasks({
                    taskIds:
                        args.task_ids,
                    status:
                        args.status,
                    priority:
                        args.priority,
                    assignedTo:
                        args.assigned_to,
                    deadline:
                        args.deadline,
                    userId:
                        req.user.id
                });

            deleteConfirmation(
                confirmationId,
                req.user.id
            );

            return res.status(200).json({
                message:
                    "AI action confirmed and executed successfully",
                tasks
            });
        }

        return res.status(400).json({
            error:
                "Unsupported AI write action"
        });
    } catch (error) {
        if (
            error.message ===
                "Authenticated user ID must be a valid integer" ||
            error.message ===
                "Invalid user ID"
        ) {
            return res.status(401).json({
                error: error.message
            });
        }

        if (
            error.message ===
                "Project not found or you are not a team member" ||
            error.message ===
                "Assigned user is not a member of the project team" ||
            error.message ===
                "You are not a member of this team" ||
            error.message ===
                "One or more tasks were not found or you are not authorized to update them" ||
            error.message ===
                "You are not the creator of one or more selected tasks" ||
            error.message ===
                "Assigned user is not a member of every selected project team"
        ) {
            return res.status(403).json({
                error: error.message
            });
        }

        if (
            error.message ===
            "Task not found"
        ) {
            return res.status(404).json({
                error: error.message
            });
        }

        if (
            error.message ===
            "Task not found or you are not the creator"
        ) {
            return res.status(403).json({
                error: error.message
            });
        }

        if (
            error.message ===
            "Project not found"
        ) {
            return res.status(404).json({
                error: error.message
            });
        }

        if (
            error.message ===
            "Project not found or you are not the creator"
        ) {
            return res.status(403).json({
                error: error.message
            });
        }

        if (
            error.message ===
                "Project name and team ID are required" ||
            error.message ===
                "Milestone name and project ID are required" ||
            error.message ===
                "At least one task ID is required" ||
            error.message ===
                "All task IDs must be valid integers" ||
            error.message ===
                "At least one task field must be provided for update" ||
            error.message ===
                "Assigned user must be a valid integer or null"
        ) {
            return res.status(400).json({
                error: error.message
            });
        }

        if (
            error.message ===
            "Bulk task update could not be completed"
        ) {
            return res.status(500).json({
                error: error.message
            });
        }

        if (
            error.code === "23503"
        ) {
            return res.status(404).json({
                error:
                    "Team or user not found"
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