const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Create a team
router.post("/", authMiddleware, async (req, res) => {
  const { name, description, workspaceId, departmentId, teamLeaderId } =
    req.body;

  if (!name) {
    return res.status(400).json({
      error: "Team name is required",
    });
  }

  try {
    // Validate department if provided
    if (departmentId) {
      const departmentResult = await pool.query(
        `SELECT id,
                organization_id
         FROM departments
         WHERE id = $1`,
        [departmentId],
      );

      if (departmentResult.rows.length === 0) {
        return res.status(404).json({
          error: "Department not found",
        });
      }

      // If a workspace is provided, make sure the department
      // belongs to the same organization as the workspace.
      if (workspaceId) {
        const workspaceOrganizationResult = await pool.query(
          `SELECT organization_id
           FROM workspaces
           WHERE id = $1`,
          [workspaceId],
        );

        if (workspaceOrganizationResult.rows.length === 0) {
          return res.status(404).json({
            error: "Workspace not found",
          });
        }

        const workspaceOrganizationId =
          workspaceOrganizationResult.rows[0].organization_id;

        if (
          workspaceOrganizationId !== departmentResult.rows[0].organization_id
        ) {
          return res.status(400).json({
            error: "Department does not belong to this workspace organization",
          });
        }
      }
    }

    // Validate Team Leader if provided
    if (teamLeaderId) {
      if (!workspaceId) {
        return res.status(400).json({
          error: "A Team Leader can only be assigned to a workspace team",
        });
      }

      const teamLeaderResult = await pool.query(
        `SELECT workspace_members.id,
                workspace_members.role,
                workspaces.type
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspaces.type IN ('PROJECT', 'COMPANY')`,
        [workspaceId, teamLeaderId],
      );

      if (teamLeaderResult.rows.length === 0) {
        return res.status(400).json({
          error: "Team Leader must be a member of this workspace",
        });
      }

      if (teamLeaderResult.rows[0].role !== "TEAM_LEADER") {
        return res.status(400).json({
          error: "Assigned user must have TEAM_LEADER role in this workspace",
        });
      }
    }

    // Workspace-linked team
    if (workspaceId) {
      console.log("CREATE TEAM DEBUG:", {
        workspaceId,
        departmentId,
        teamLeaderId,
        authenticatedUserId: req.user.id,
        authenticatedUser: req.user,
      });

      const workspaceResult = await pool.query(
        `SELECT workspace_members.id,
                workspaces.type
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspace_members.role = 'TEAM_LEADER'
           AND workspaces.type IN ('PROJECT', 'COMPANY')`,
        [workspaceId, req.user.id],
      );

      if (workspaceResult.rows.length === 0) {
        return res.status(403).json({
          error:
            "Only the Workspace Team Leader can create a team in this workspace",
        });
      }
    }

    const teamResult = await pool.query(
      `INSERT INTO teams
       (name, description, created_by, workspace_id, department_id, team_leader_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name,
        description || null,
        req.user.id,
        workspaceId || null,
        departmentId || null,
        teamLeaderId || null,
      ],
    );

    const team = teamResult.rows[0];

    // Creator automatically becomes a team member
    await pool.query(
      "INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)",
      [team.id, req.user.id],
    );

    // Assigned Team Leader automatically becomes a team member
    if (teamLeaderId && Number(teamLeaderId) !== Number(req.user.id)) {
      await pool.query(
        `INSERT INTO team_members (team_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (team_id, user_id) DO NOTHING`,
        [team.id, teamLeaderId],
      );
    }

    res.status(201).json(team);
  } catch (error) {
    console.error("Team creation error:", error.message);

    if (error.code === "23503") {
      return res.status(404).json({
        error: "Workspace, department, team leader, or user not found",
      });
    }

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Get teams of logged-in user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT teams.id,
              teams.name,
              teams.description,
              teams.created_by,
              teams.created_at,
              teams.workspace_id,
              teams.department_id,
              departments.name AS department_name,
              teams.team_leader_id,
              team_leader.name AS team_leader_name,
              team_leader.email AS team_leader_email
       FROM teams
       JOIN team_members
         ON teams.id = team_members.team_id
       LEFT JOIN departments
         ON teams.department_id = departments.id
       LEFT JOIN users AS team_leader
         ON teams.team_leader_id = team_leader.id
       WHERE team_members.user_id = $1
       ORDER BY teams.created_at DESC`,
      [req.user.id],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Team fetch error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Get team members
router.get("/:teamId/members", authMiddleware, async (req, res) => {
  try {
    // Verify that the logged-in user belongs to this team
    const accessResult = await pool.query(
      `SELECT teams.id,
              teams.workspace_id
       FROM teams
       JOIN team_members
         ON teams.id = team_members.team_id
       WHERE teams.id = $1
         AND team_members.user_id = $2`,
      [req.params.teamId, req.user.id],
    );

    if (accessResult.rows.length === 0) {
      return res.status(403).json({
        error: "You are not a member of this team",
      });
    }

    const result = await pool.query(
      `SELECT users.id,
              users.name,
              users.email,
              team_members.joined_at
       FROM team_members
       JOIN users
         ON team_members.user_id = users.id
       WHERE team_members.team_id = $1
       ORDER BY team_members.joined_at ASC`,
      [req.params.teamId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Team members fetch error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Update a team
router.put("/:teamId", authMiddleware, async (req, res) => {
  const { name, description, departmentId, teamLeaderId } = req.body;

  if (!name) {
    return res.status(400).json({
      error: "Team name is required",
    });
  }

  try {
    const teamResult = await pool.query(
      `SELECT id,
              workspace_id,
              created_by,
              department_id,
              team_leader_id
       FROM teams
       WHERE id = $1`,
      [req.params.teamId],
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        error: "Team not found",
      });
    }

    const team = teamResult.rows[0];

    // Validate department if provided
    if (departmentId) {
      const departmentResult = await pool.query(
        `SELECT id,
                organization_id
         FROM departments
         WHERE id = $1`,
        [departmentId],
      );

      if (departmentResult.rows.length === 0) {
        return res.status(404).json({
          error: "Department not found",
        });
      }

      // If the team belongs to a workspace, the department
      // must belong to the same organization.
      if (team.workspace_id) {
        const workspaceOrganizationResult = await pool.query(
          `SELECT organization_id
           FROM workspaces
           WHERE id = $1`,
          [team.workspace_id],
        );

        if (workspaceOrganizationResult.rows.length === 0) {
          return res.status(404).json({
            error: "Workspace not found",
          });
        }

        const workspaceOrganizationId =
          workspaceOrganizationResult.rows[0].organization_id;

        if (
          workspaceOrganizationId !== departmentResult.rows[0].organization_id
        ) {
          return res.status(400).json({
            error: "Department does not belong to this workspace organization",
          });
        }
      }
    }

    // Validate Team Leader if provided
    if (teamLeaderId) {
      if (!team.workspace_id) {
        return res.status(400).json({
          error: "A Team Leader can only be assigned to a workspace team",
        });
      }

      const teamLeaderResult = await pool.query(
        `SELECT workspace_members.id,
                workspace_members.role,
                workspaces.type
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspaces.type IN ('PROJECT', 'COMPANY')`,
        [team.workspace_id, teamLeaderId],
      );

      if (teamLeaderResult.rows.length === 0) {
        return res.status(400).json({
          error: "Team Leader must be a member of this workspace",
        });
      }

      if (teamLeaderResult.rows[0].role !== "TEAM_LEADER") {
        return res.status(400).json({
          error: "Assigned user must have TEAM_LEADER role in this workspace",
        });
      }
    }

    // Workspace-linked team
    if (team.workspace_id) {
      const leaderResult = await pool.query(
        `SELECT workspace_members.id,
                workspaces.type
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
          error: "Only the Workspace Team Leader can update this team",
        });
      }
    } else {
      // Preserve legacy team behavior
      if (team.created_by !== req.user.id) {
        return res.status(403).json({
          error: "Only the team creator can update this team",
        });
      }
    }

    const result = await pool.query(
      `UPDATE teams
       SET name = $1,
           description = $2,
           department_id = $3,
           team_leader_id = $4
       WHERE id = $5
       RETURNING *`,
      [
        name.trim(),
        description || null,
        departmentId || null,
        teamLeaderId || null,
        req.params.teamId,
      ],
    );

    // Assigned Team Leader automatically becomes a team member
    if (teamLeaderId && Number(teamLeaderId) !== Number(req.user.id)) {
      await pool.query(
        `INSERT INTO team_members (team_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (team_id, user_id) DO NOTHING`,
        [req.params.teamId, teamLeaderId],
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Team update error:", error.message);

    if (error.code === "23503") {
      return res.status(404).json({
        error: "Workspace, department, team leader, or user not found",
      });
    }

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Delete a team
router.delete("/:teamId", authMiddleware, async (req, res) => {
  try {
    const teamResult = await pool.query(
      `SELECT id,
              workspace_id,
              created_by
       FROM teams
       WHERE id = $1`,
      [req.params.teamId],
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        error: "Team not found",
      });
    }

    const team = teamResult.rows[0];

    // Workspace-linked team
    if (team.workspace_id) {
      const leaderResult = await pool.query(
        `SELECT workspace_members.id,
                workspaces.type
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
          error: "Only the Workspace Team Leader can delete this team",
        });
      }
    } else {
      // Preserve legacy team behavior
      if (team.created_by !== req.user.id) {
        return res.status(403).json({
          error: "Only the team creator can delete this team",
        });
      }
    }

    const result = await pool.query(
      `DELETE FROM teams
       WHERE id = $1
       RETURNING *`,
      [req.params.teamId],
    );

    res.json({
      message: "Team deleted successfully",
      team: result.rows[0],
    });
  } catch (error) {
    console.error("Team deletion error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Add a member to a team
router.post("/:teamId/members", authMiddleware, async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: "User ID is required",
    });
  }

  try {
    const teamResult = await pool.query(
      `SELECT id,
              workspace_id,
              created_by
       FROM teams
       WHERE id = $1`,
      [req.params.teamId],
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        error: "Team not found",
      });
    }

    const team = teamResult.rows[0];

    // Workspace-linked team
    if (team.workspace_id) {
      const leaderResult = await pool.query(
        `SELECT workspace_members.id,
                workspaces.type
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
          error: "Only the Workspace Team Leader can add members to this team",
        });
      }

      const workspaceMemberResult = await pool.query(
        `SELECT id,
                role
         FROM workspace_members
         WHERE workspace_id = $1
           AND user_id = $2`,
        [team.workspace_id, userId],
      );

      if (workspaceMemberResult.rows.length === 0) {
        return res.status(403).json({
          error: "User must already be a member of this workspace",
        });
      }

      if (workspaceMemberResult.rows[0].role !== "USER") {
        return res.status(400).json({
          error: "Only workspace users can be added to this team",
        });
      }
    } else {
      // Preserve legacy team behavior
      if (team.created_by !== req.user.id) {
        return res.status(403).json({
          error: "Only the team creator can add members",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO team_members (team_id, user_id)
       VALUES ($1, $2)
       RETURNING *`,
      [req.params.teamId, userId],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Add member error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "User is already a member of this team",
      });
    }

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

// Remove a member from a team
router.delete("/:teamId/members/:userId", authMiddleware, async (req, res) => {
  try {
    const teamResult = await pool.query(
      `SELECT id,
              workspace_id,
              created_by
       FROM teams
       WHERE id = $1`,
      [req.params.teamId],
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        error: "Team not found",
      });
    }

    const team = teamResult.rows[0];

    // Workspace-linked team
    if (team.workspace_id) {
      const leaderResult = await pool.query(
        `SELECT workspace_members.id,
                workspaces.type
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
            "Only the Workspace Team Leader can remove members from this team",
        });
      }

      const targetMemberResult = await pool.query(
        `SELECT workspace_members.role
         FROM workspace_members
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2`,
        [team.workspace_id, req.params.userId],
      );

      if (targetMemberResult.rows.length > 0) {
        if (targetMemberResult.rows[0].role !== "USER") {
          return res.status(400).json({
            error: "Only workspace users can be removed from this team",
          });
        }
      }
    } else {
      // Preserve legacy team behavior
      if (team.created_by !== req.user.id) {
        return res.status(403).json({
          error: "Only the team creator can remove members",
        });
      }
    }

    const result = await pool.query(
      `DELETE FROM team_members
       WHERE team_id = $1
         AND user_id = $2
       RETURNING *`,
      [req.params.teamId, req.params.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Team member not found",
      });
    }

    res.json({
      message: "Team member removed successfully",
      member: result.rows[0],
    });
  } catch (error) {
    console.error("Remove member error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Get a single team
router.get("/:teamId", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT teams.id,
              teams.name,
              teams.description,
              teams.created_by,
              teams.created_at,
              teams.workspace_id,
              teams.department_id,
              departments.name AS department_name,
              teams.team_leader_id,
              team_leader.name AS team_leader_name,
              team_leader.email AS team_leader_email
       FROM teams
       JOIN team_members
         ON teams.id = team_members.team_id
       LEFT JOIN departments
         ON teams.department_id = departments.id
       LEFT JOIN users AS team_leader
         ON teams.team_leader_id = team_leader.id
       WHERE teams.id = $1
         AND team_members.user_id = $2`,
      [req.params.teamId, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Team not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Single team fetch error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

module.exports = router;
