const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Create a comment
router.post("/", authMiddleware, async (req, res) => {
  const { content, taskId, projectId } = req.body;

  if (!content || (!taskId && !projectId)) {
    return res.status(400).json({
      error: "Comment content and task ID or project ID are required",
    });
  }

  try {
    let workspaceId = null;
    let teamId = null;

    // Check task access
    if (taskId) {
      const taskResult = await pool.query(
        `SELECT tasks.id,
                        projects.id AS project_id,
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

      workspaceId = task.workspace_id;
      teamId = task.team_id;

      if (workspaceId) {
        const membershipResult = await pool.query(
          `SELECT id
                     FROM workspace_members
                     WHERE workspace_id = $1
                       AND user_id = $2`,
          [workspaceId, req.user.id],
        );

        if (membershipResult.rows.length === 0) {
          return res.status(403).json({
            error: "You are not a member of this workspace",
          });
        }
      } else {
        const teamMemberResult = await pool.query(
          `SELECT id
                     FROM team_members
                     WHERE team_id = $1
                       AND user_id = $2`,
          [teamId, req.user.id],
        );

        if (teamMemberResult.rows.length === 0) {
          return res.status(404).json({
            error: "Task not found or you are not a team member",
          });
        }
      }
    }

    // Check project access
    if (projectId) {
      const projectResult = await pool.query(
        `SELECT projects.id,
                        projects.team_id,
                        teams.workspace_id
                 FROM projects
                 JOIN teams
                    ON projects.team_id = teams.id
                 WHERE projects.id = $1`,
        [projectId],
      );

      if (projectResult.rows.length === 0) {
        return res.status(404).json({
          error: "Project not found",
        });
      }

      const project = projectResult.rows[0];

      workspaceId = project.workspace_id;
      teamId = project.team_id;

      if (workspaceId) {
        const membershipResult = await pool.query(
          `SELECT id
                     FROM workspace_members
                     WHERE workspace_id = $1
                       AND user_id = $2`,
          [workspaceId, req.user.id],
        );

        if (membershipResult.rows.length === 0) {
          return res.status(403).json({
            error: "You are not a member of this workspace",
          });
        }
      } else {
        const teamMemberResult = await pool.query(
          `SELECT id
                     FROM team_members
                     WHERE team_id = $1
                       AND user_id = $2`,
          [teamId, req.user.id],
        );

        if (teamMemberResult.rows.length === 0) {
          return res.status(404).json({
            error: "Project not found or you are not a team member",
          });
        }
      }
    }

    const result = await pool.query(
      `INSERT INTO comments (content, user_id, task_id, project_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
      [content, req.user.id, taskId || null, projectId || null],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Comment creation error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Get comments for a task
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

    if (task.workspace_id) {
      const membershipResult = await pool.query(
        `SELECT id
                 FROM workspace_members
                 WHERE workspace_id = $1
                   AND user_id = $2`,
        [task.workspace_id, req.user.id],
      );

      if (membershipResult.rows.length === 0) {
        return res.status(403).json({
          error: "You are not a member of this workspace",
        });
      }
    } else {
      const teamMemberResult = await pool.query(
        `SELECT id
                 FROM team_members
                 WHERE team_id = $1
                   AND user_id = $2`,
        [task.team_id, req.user.id],
      );

      if (teamMemberResult.rows.length === 0) {
        return res.status(404).json({
          error: "Task not found or you are not a team member",
        });
      }
    }

    const result = await pool.query(
      `SELECT comments.id, comments.content,
                    comments.user_id, users.name AS user_name,
                    comments.task_id, comments.created_at
             FROM comments
             JOIN users
                ON comments.user_id = users.id
             WHERE comments.task_id = $1
             ORDER BY comments.id`,
      [req.params.taskId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Comment fetch error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Get comments for a project
router.get("/project/:projectId", authMiddleware, async (req, res) => {
  try {
    const projectResult = await pool.query(
      `SELECT projects.id,
                    projects.team_id,
                    teams.workspace_id
             FROM projects
             JOIN teams
                ON projects.team_id = teams.id
             WHERE projects.id = $1`,
      [req.params.projectId],
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const project = projectResult.rows[0];

    if (project.workspace_id) {
      const membershipResult = await pool.query(
        `SELECT id
                 FROM workspace_members
                 WHERE workspace_id = $1
                   AND user_id = $2`,
        [project.workspace_id, req.user.id],
      );

      if (membershipResult.rows.length === 0) {
        return res.status(403).json({
          error: "You are not a member of this workspace",
        });
      }
    } else {
      const teamMemberResult = await pool.query(
        `SELECT id
                 FROM team_members
                 WHERE team_id = $1
                   AND user_id = $2`,
        [project.team_id, req.user.id],
      );

      if (teamMemberResult.rows.length === 0) {
        return res.status(404).json({
          error: "Project not found or you are not a team member",
        });
      }
    }

    const result = await pool.query(
      `SELECT comments.id, comments.content,
                    comments.user_id, users.name AS user_name,
                    comments.project_id, comments.created_at
             FROM comments
             JOIN users
                ON comments.user_id = users.id
             WHERE comments.project_id = $1
             ORDER BY comments.id`,
      [req.params.projectId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Comment fetch error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Update a comment
router.put("/:id", authMiddleware, async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({
      error: "Comment content is required",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE comments
             SET content = $1
             WHERE id = $2
               AND user_id = $3
             RETURNING *`,
      [content, req.params.id, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Comment not found or you are not the author",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Comment update error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Delete a comment
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM comments
             WHERE id = $1
               AND user_id = $2
             RETURNING *`,
      [req.params.id, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Comment not found or you are not the author",
      });
    }

    res.json({
      message: "Comment deleted successfully",
      comment: result.rows[0],
    });
  } catch (error) {
    console.error("Comment deletion error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

module.exports = router;
