const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Create a subtask
router.post("/", authMiddleware, async (req, res) => {
  const { title, taskId, status } = req.body;

  if (!title || !taskId) {
    return res.status(400).json({
      error: "Subtask title and task ID are required",
    });
  }

  try {
    const taskResult = await pool.query(
      `SELECT tasks.id,
                    projects.team_id,
                    teams.workspace_id
             FROM tasks
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN teams
                ON projects.team_id = teams.id
             WHERE tasks.id = $1`,
      [taskId],
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const task = taskResult.rows[0];

    // Workspace-linked project
    if (task.workspace_id) {
      const leaderResult = await pool.query(
        `SELECT workspace_members.id
                 FROM workspace_members
                 JOIN workspaces
                    ON workspace_members.workspace_id = workspaces.id
                 WHERE workspace_members.workspace_id = $1
                   AND workspace_members.user_id = $2
                   AND workspace_members.role = 'TEAM_LEADER'
                   AND workspaces.type = 'PROJECT'`,
        [task.workspace_id, req.user.id],
      );

      if (leaderResult.rows.length === 0) {
        return res.status(403).json({
          error: "Only the Project Team Leader can create subtasks",
        });
      }
    } else {
      // Preserve legacy behavior
      const memberResult = await pool.query(
        `SELECT team_members.user_id
                 FROM team_members
                 WHERE team_members.team_id = $1
                   AND team_members.user_id = $2`,
        [task.team_id, req.user.id],
      );

      if (memberResult.rows.length === 0) {
        return res.status(404).json({
          error: "Task not found or you are not a team member",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO subtasks (title, task_id, status)
             VALUES ($1, $2, $3)
             RETURNING *`,
      [title, taskId, status || "pending"],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Subtask creation error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Get subtasks for a task
router.get("/task/:taskId", authMiddleware, async (req, res) => {
  try {
    const taskResult = await pool.query(
      `SELECT tasks.id,
                    projects.team_id,
                    teams.workspace_id
             FROM tasks
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN teams
                ON projects.team_id = teams.id
             WHERE tasks.id = $1`,
      [req.params.taskId],
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const task = taskResult.rows[0];

    // Workspace-linked project
    if (task.workspace_id) {
      const memberResult = await pool.query(
        `SELECT workspace_members.id
                 FROM workspace_members
                 JOIN workspaces
                    ON workspace_members.workspace_id = workspaces.id
                 WHERE workspace_members.workspace_id = $1
                   AND workspace_members.user_id = $2
                   AND workspaces.type = 'PROJECT'`,
        [task.workspace_id, req.user.id],
      );

      if (memberResult.rows.length === 0) {
        return res.status(403).json({
          error: "You are not a member of this workspace",
        });
      }
    } else {
      // Preserve legacy behavior
      const memberResult = await pool.query(
        `SELECT team_members.user_id
                 FROM team_members
                 WHERE team_members.team_id = $1
                   AND team_members.user_id = $2`,
        [task.team_id, req.user.id],
      );

      if (memberResult.rows.length === 0) {
        return res.status(404).json({
          error: "Task not found or you are not a team member",
        });
      }
    }

    const result = await pool.query(
      `SELECT id, title, task_id, status, created_at
             FROM subtasks
             WHERE task_id = $1
             ORDER BY id`,
      [req.params.taskId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Subtask fetch error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Update a subtask
router.put("/:id", authMiddleware, async (req, res) => {
  const { title, status } = req.body;

  if (!title) {
    return res.status(400).json({
      error: "Subtask title is required",
    });
  }

  try {
    const subtaskResult = await pool.query(
      `SELECT subtasks.id,
                    tasks.id AS task_id,
                    projects.team_id,
                    teams.workspace_id
             FROM subtasks
             JOIN tasks
                ON subtasks.task_id = tasks.id
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN teams
                ON projects.team_id = teams.id
             WHERE subtasks.id = $1`,
      [req.params.id],
    );

    if (subtaskResult.rows.length === 0) {
      return res.status(404).json({
        error: "Subtask not found",
      });
    }

    const subtask = subtaskResult.rows[0];

    // Workspace-linked project
    if (subtask.workspace_id) {
      const leaderResult = await pool.query(
        `SELECT workspace_members.id
                 FROM workspace_members
                 JOIN workspaces
                    ON workspace_members.workspace_id = workspaces.id
                 WHERE workspace_members.workspace_id = $1
                   AND workspace_members.user_id = $2
                   AND workspace_members.role = 'TEAM_LEADER'
                   AND workspaces.type = 'PROJECT'`,
        [subtask.workspace_id, req.user.id],
      );

      if (leaderResult.rows.length === 0) {
        return res.status(403).json({
          error: "Only the Project Team Leader can update subtasks",
        });
      }
    } else {
      // Preserve legacy behavior
      const memberResult = await pool.query(
        `SELECT team_members.user_id
                 FROM team_members
                 WHERE team_members.team_id = $1
                   AND team_members.user_id = $2`,
        [subtask.team_id, req.user.id],
      );

      if (memberResult.rows.length === 0) {
        return res.status(404).json({
          error: "Subtask not found",
        });
      }
    }

    const result = await pool.query(
      `UPDATE subtasks
             SET title = $1,
                 status = $2
             WHERE id = $3
             RETURNING *`,
      [title, status || "pending", req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Subtask not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Subtask update error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Delete a subtask
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const subtaskResult = await pool.query(
      `SELECT subtasks.id,
                    tasks.id AS task_id,
                    projects.team_id,
                    teams.workspace_id
             FROM subtasks
             JOIN tasks
                ON subtasks.task_id = tasks.id
             JOIN projects
                ON tasks.project_id = projects.id
             JOIN teams
                ON projects.team_id = teams.id
             WHERE subtasks.id = $1`,
      [req.params.id],
    );

    if (subtaskResult.rows.length === 0) {
      return res.status(404).json({
        error: "Subtask not found",
      });
    }

    const subtask = subtaskResult.rows[0];

    // Workspace-linked project
    if (subtask.workspace_id) {
      const leaderResult = await pool.query(
        `SELECT workspace_members.id
                 FROM workspace_members
                 JOIN workspaces
                    ON workspace_members.workspace_id = workspaces.id
                 WHERE workspace_members.workspace_id = $1
                   AND workspace_members.user_id = $2
                   AND workspace_members.role = 'TEAM_LEADER'
                   AND workspaces.type = 'PROJECT'`,
        [subtask.workspace_id, req.user.id],
      );

      if (leaderResult.rows.length === 0) {
        return res.status(403).json({
          error: "Only the Project Team Leader can delete subtasks",
        });
      }
    } else {
      // Preserve legacy behavior
      const memberResult = await pool.query(
        `SELECT team_members.user_id
                 FROM team_members
                 WHERE team_members.team_id = $1
                   AND team_members.user_id = $2`,
        [subtask.team_id, req.user.id],
      );

      if (memberResult.rows.length === 0) {
        return res.status(404).json({
          error: "Subtask not found",
        });
      }
    }

    const result = await pool.query(
      `DELETE FROM subtasks
             WHERE id = $1
             RETURNING *`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Subtask not found",
      });
    }

    res.json({
      message: "Subtask deleted successfully",
      subtask: result.rows[0],
    });
  } catch (error) {
    console.error("Subtask deletion error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

module.exports = router;
