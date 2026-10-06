const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const { logProjectActivity } = require("../utils/projectActivity");

const router = express.Router();

// ============================================================
// CREATE A PROJECT
// ============================================================

router.post("/", authMiddleware, async (req, res) => {
  const { name, description, teamId } = req.body;

  if (!name || !teamId) {
    return res.status(400).json({
      error: "Project name and team ID are required",
    });
  }

  try {
    // Get the team and check whether it belongs to a workspace
    const teamResult = await pool.query(
      `SELECT id, workspace_id, created_by
       FROM teams
       WHERE id = $1`,
      [teamId],
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        error: "Team not found",
      });
    }

    const team = teamResult.rows[0];

    // Workspace-linked team
    if (team.workspace_id) {
      // Only the TEAM_LEADER of the workspace
      // can create a project
      const leaderResult = await pool.query(
        `SELECT workspace_members.id
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspace_members.role = 'TEAM_LEADER'
           AND workspaces.type IN ('PROJECT', 'COMPANY')`,
        [team.workspace_id, req.user.id],
      );

      if (leaderResult.rows.length === 0) {
        return res.status(403).json({
          error:
            "Only the Workspace Team Leader can create a project in this workspace",
        });
      }
    } else {
      // Preserve existing behavior for legacy teams:
      // user must be a member of the team
      const memberResult = await pool.query(
        `SELECT team_members.user_id
         FROM team_members
         WHERE team_members.team_id = $1
           AND team_members.user_id = $2`,
        [teamId, req.user.id],
      );

      if (memberResult.rows.length === 0) {
        return res.status(403).json({
          error: "You are not a member of this team",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO projects (name, description, team_id, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        name.trim(),
        description ? description.trim() : null,
        teamId,
        req.user.id,
      ],
    );

    const createdProject = result.rows[0];

    // ========================================================
    // PROJECT ACTIVITY
    // ========================================================

    await logProjectActivity(
      createdProject.id,
      req.user.id,
      "PROJECT_CREATED",
      `Project "${createdProject.name}" was created`,
    );

    res.status(201).json(createdProject);
  } catch (error) {
    console.error("Project creation error:", error.message);

    if (error.code === "23503") {
      return res.status(404).json({
        error: "Team or user not found",
      });
    }

    res.status(500).json({
      error: "Database error",
    });
  }
});

// ============================================================
// GET PROJECTS OF LOGGED-IN USER
// ============================================================

router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT projects.id,
              projects.name,
              projects.description,
              projects.team_id,
              projects.created_by,
              projects.created_at
       FROM projects
       JOIN teams
         ON projects.team_id = teams.id
       JOIN team_members
         ON teams.id = team_members.team_id
       WHERE team_members.user_id = $1`,
      [req.user.id],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Project fetch error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// ============================================================
// GET A SINGLE PROJECT
// ============================================================

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT projects.id,
              projects.name,
              projects.description,
              projects.team_id,
              projects.created_by,
              projects.created_at
       FROM projects
       JOIN teams
         ON projects.team_id = teams.id
       JOIN team_members
         ON teams.id = team_members.team_id
       WHERE projects.id = $1
         AND team_members.user_id = $2`,
      [req.params.id, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Project fetch error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// ============================================================
// UPDATE A PROJECT
// ============================================================

router.put("/:id", authMiddleware, async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({
      error: "Project name is required",
    });
  }

  try {
    // Get project + team + workspace information
    const projectResult = await pool.query(
      `SELECT projects.id,
              projects.created_by,
              teams.workspace_id
       FROM projects
       JOIN teams
         ON projects.team_id = teams.id
       WHERE projects.id = $1`,
      [req.params.id],
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const project = projectResult.rows[0];

    // ====================================================
    // WORKSPACE PROJECT
    // ====================================================

    if (project.workspace_id) {
      // Only TEAM_LEADER of the workspace can update
      const leaderResult = await pool.query(
        `SELECT workspace_members.id
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspace_members.role = 'TEAM_LEADER'
           AND workspaces.type IN ('PROJECT', 'COMPANY')`,
        [project.workspace_id, req.user.id],
      );

      if (leaderResult.rows.length === 0) {
        return res.status(403).json({
          error: "Only the Workspace Team Leader can update this project",
        });
      }
    } else {
      // Preserve existing behavior for legacy projects
      if (project.created_by !== req.user.id) {
        return res.status(403).json({
          error: "Only the project creator can update this project",
        });
      }
    }

    const result = await pool.query(
      `UPDATE projects
       SET name = $1,
           description = $2
       WHERE id = $3
       RETURNING *`,
      [name.trim(), description ? description.trim() : null, req.params.id],
    );

    const updatedProject = result.rows[0];

    // ========================================================
    // PROJECT ACTIVITY
    // ========================================================

    await logProjectActivity(
      updatedProject.id,
      req.user.id,
      "PROJECT_UPDATED",
      `Project "${updatedProject.name}" was updated`,
    );

    res.json(updatedProject);
  } catch (error) {
    console.error("Project update error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// ============================================================
// DELETE A PROJECT
// ============================================================

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    // Get project + team + workspace information
    const projectResult = await pool.query(
      `SELECT projects.id,
              projects.created_by,
              teams.workspace_id
       FROM projects
       JOIN teams
         ON projects.team_id = teams.id
       WHERE projects.id = $1`,
      [req.params.id],
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const project = projectResult.rows[0];

    // ====================================================
    // WORKSPACE PROJECT
    // ====================================================

    if (project.workspace_id) {
      // Only TEAM_LEADER of the workspace can delete
      const leaderResult = await pool.query(
        `SELECT workspace_members.id
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspace_members.role = 'TEAM_LEADER'
           AND workspaces.type IN ('PROJECT', 'COMPANY')`,
        [project.workspace_id, req.user.id],
      );

      if (leaderResult.rows.length === 0) {
        return res.status(403).json({
          error: "Only the Workspace Team Leader can delete this project",
        });
      }
    } else {
      // Preserve existing behavior for legacy projects
      if (project.created_by !== req.user.id) {
        return res.status(403).json({
          error: "Only the project creator can delete this project",
        });
      }
    }

    const result = await pool.query(
      `DELETE FROM projects
       WHERE id = $1
       RETURNING *`,
      [req.params.id],
    );

    res.json({
      message: "Project deleted successfully",
      project: result.rows[0],
    });
  } catch (error) {
    console.error("Project deletion error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

module.exports = router;
