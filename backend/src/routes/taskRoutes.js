const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const {
    createTask,
    updateTask,
    deleteTask
} = require("../services/task.service");

const router = express.Router();

router.use(express.json());


// CREATE TASK
router.post("/", authMiddleware, async (req, res) => {
    const {
        title,
        description,
        projectId,
        assignedTo,
        status,
        priority,
        deadline
    } = req.body;

    if (!title || !projectId) {
        return res.status(400).json({
            error: "Task title and project ID are required"
        });
    }

    try {
        const task = await createTask({
            title,
            description: description || null,
            projectId,
            assignedTo: assignedTo || null,
            status: status || "pending",
            priority: priority || "medium",
            deadline: deadline || null,
            userId: req.user.id
        });

        res.status(201).json(task);
    } catch (error) {
        console.error("Task creation error:", error.message);

        if (
            error.message ===
            "Project not found or you are not a team member"
        ) {
            return res.status(404).json({
                error: error.message
            });
        }

        if (
            error.message ===
            "Assigned user is not a member of the project team"
        ) {
            return res.status(400).json({
                error: error.message
            });
        }

        res.status(500).json({
            error: "Database error"
        });
    }
});


// GET ALL TASKS
router.get("/", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT tasks.*
             FROM tasks
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE team_members.user_id = $1
             ORDER BY tasks.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Task fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});


// GET SINGLE TASK
router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT tasks.*
             FROM tasks
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE tasks.id = $1
               AND team_members.user_id = $2`,
            [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Task not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Task fetch error:", error.message);

        res.status(500).json({
            error: "Database error"
        });
    }
});


// UPDATE TASK
router.put("/:id", authMiddleware, async (req, res) => {
    const {
        title,
        description,
        assignedTo,
        status,
        priority,
        deadline
    } = req.body;

    if (!title) {
        return res.status(400).json({
            error: "Task title is required"
        });
    }

    try {
        const task = await updateTask({
            taskId: req.params.id,
            title,
            description: description || null,
            assignedTo: assignedTo || null,
            status: status || "pending",
            priority: priority || "medium",
            deadline: deadline || null,
            userId: req.user.id
        });

        res.json(task);
    } catch (error) {
        console.error("Task update error:", error.message);

        if (error.message === "Task not found") {
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
            "Assigned user is not a member of the project team"
        ) {
            return res.status(400).json({
                error: error.message
            });
        }

        res.status(500).json({
            error: "Database error"
        });
    }
});


// DELETE TASK
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const task = await deleteTask({
            taskId: req.params.id,
            userId: req.user.id
        });

        res.json({
            message: "Task deleted successfully",
            task
        });
    } catch (error) {
        console.error("Task deletion error:", error.message);

        if (error.message === "Task not found") {
            return res.status(404).json({
                error: error.message
            });
        }

        if (
            error.message ===
            "Task not found or you are not the creator"
        ) {
            return res.status(404).json({
                error: error.message
            });
        }

        res.status(500).json({
            error: "Database error"
        });
    }
});


module.exports = router;