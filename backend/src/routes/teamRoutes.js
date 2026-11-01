const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Check Whether a User Has the Team Leader Role in a Workspace
|--------------------------------------------------------------------------
|
| Supports both:
| 1. The existing workspace_members.role field.
| 2. Additional roles stored in workspace_member_roles.
|
| Individual, Project, and Company workspaces are supported.
|
*/

const getTeamLeaderMembership = async (workspaceId, userId) => {
  return pool.query(
    `SELECT
       wm.id,
       w.type,
       (
         UPPER(TRIM(wm.role::TEXT)) = 'TEAM_LEADER'
         OR EXISTS (
           SELECT 1
           FROM workspace_member_roles wmr
           WHERE wmr.workspace_member_id = wm.id
             AND UPPER(TRIM(wmr.role::TEXT)) = 'TEAM_LEADER'
         )
       ) AS has_team_leader_role
     FROM workspace_members wm
     JOIN workspaces w
       ON w.id = wm.workspace_id
     WHERE wm.workspace_id = $1
       AND wm.user_id = $2
       AND w.type IN ('INDIVIDUAL', 'PROJECT', 'COMPANY')
     LIMIT 1`,
    [workspaceId, userId],
  );
};

/*
|--------------------------------------------------------------------------
| Create a Team
|--------------------------------------------------------------------------
*/

router.post("/", authMiddleware, async (req, res) => {
  const { name, description, workspaceId, departmentId, teamLeaderId } =
    req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      error: "Team name is required",
    });
  }

  try {
    // Validate department if provided.
    if (departmentId) {
      const departmentResult = await pool.query(
        `SELECT
           id,
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

    // Validate the assigned Team Leader if provided.
    if (teamLeaderId) {
      if (!workspaceId) {
        return res.status(400).json({
          error: "A Team Leader can only be assigned to a workspace team",
        });
      }

      const teamLeaderResult = await getTeamLeaderMembership(
        workspaceId,
        teamLeaderId,
      );

      if (teamLeaderResult.rows.length === 0) {
        return res.status(400).json({
          error: "Team Leader must be a member of this workspace",
        });
      }

      if (!teamLeaderResult.rows[0].has_team_leader_role) {
        return res.status(400).json({
          error:
            "Assigned user must have the TEAM_LEADER role in this workspace",
        });
      }
    }

    // Only a Team Leader in the selected workspace may create its team.
    if (workspaceId) {
      const workspaceResult = await getTeamLeaderMembership(
        workspaceId,
        req.user.id,
      );

      if (
        workspaceResult.rows.length === 0 ||
        !workspaceResult.rows[0].has_team_leader_role
      ) {
        return res.status(403).json({
          error:
            "Only the Workspace Team Leader can create a team in this workspace",
        });
      }
    }

    const teamResult = await pool.query(
      `INSERT INTO teams
       (
         name,
         description,
         created_by,
         workspace_id,
         department_id,
         team_leader_id
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name.trim(),
        description || null,
        req.user.id,
        workspaceId || null,
        departmentId || null,
        teamLeaderId || null,
      ],
    );

    const team = teamResult.rows[0];

    // Add the creator to the team.
    await pool.query(
      `INSERT INTO team_members (team_id, user_id)
       VALUES ($1, $2)`,
      [team.id, req.user.id],
    );

    // Add the assigned Team Leader if they are a different user.
    if (teamLeaderId && Number(teamLeaderId) !== Number(req.user.id)) {
      await pool.query(
        `INSERT INTO team_members (team_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (team_id, user_id) DO NOTHING`,
        [team.id, teamLeaderId],
      );
    }

    return res.status(201).json({
      message: "Team created successfully",
      team,
    });
  } catch (error) {
    console.error("Team creation error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "This team membership already exists",
      });
    }

    if (error.code === "23503") {
      return res.status(404).json({
        error: "Workspace, department, team leader, or user not found",
      });
    }

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Get Teams of the Logged-in User
|--------------------------------------------------------------------------
*/

router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         teams.id,
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

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Team fetch error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Get Team Members
|--------------------------------------------------------------------------
*/

router.get("/:teamId/members", authMiddleware, async (req, res) => {
  try {
    const accessResult = await pool.query(
      `SELECT
         teams.id,
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
      `SELECT
         users.id,
         users.name,
         users.email,
         team_members.joined_at,
         workspace_members.role AS workspace_role
       FROM team_members
       JOIN users
         ON team_members.user_id = users.id
       LEFT JOIN teams
         ON team_members.team_id = teams.id
       LEFT JOIN workspace_members
         ON workspace_members.workspace_id = teams.workspace_id
        AND workspace_members.user_id = team_members.user_id
       WHERE team_members.team_id = $1
       ORDER BY team_members.joined_at ASC`,
      [req.params.teamId],
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Team members fetch error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Update a Team
|--------------------------------------------------------------------------
*/

router.put("/:teamId", authMiddleware, async (req, res) => {
  const { name, description, departmentId, teamLeaderId } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      error: "Team name is required",
    });
  }

  try {
    const teamResult = await pool.query(
      `SELECT
         id,
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

    // Validate department if provided.
    if (departmentId) {
      const departmentResult = await pool.query(
        `SELECT
           id,
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

    // Validate the assigned Team Leader if provided.
    if (teamLeaderId) {
      if (!team.workspace_id) {
        return res.status(400).json({
          error: "A Team Leader can only be assigned to a workspace team",
        });
      }

      const teamLeaderResult = await getTeamLeaderMembership(
        team.workspace_id,
        teamLeaderId,
      );

      if (teamLeaderResult.rows.length === 0) {
        return res.status(400).json({
          error: "Team Leader must be a member of this workspace",
        });
      }

      if (!teamLeaderResult.rows[0].has_team_leader_role) {
        return res.status(400).json({
          error:
            "Assigned user must have the TEAM_LEADER role in this workspace",
        });
      }
    }

    if (team.workspace_id) {
      const leaderResult = await getTeamLeaderMembership(
        team.workspace_id,
        req.user.id,
      );

      if (
        leaderResult.rows.length === 0 ||
        !leaderResult.rows[0].has_team_leader_role
      ) {
        return res.status(403).json({
          error: "Only the Workspace Team Leader can update this team",
        });
      }
    } else if (Number(team.created_by) !== Number(req.user.id)) {
      // Preserve legacy behavior for teams without a workspace.
      return res.status(403).json({
        error: "Only the team creator can update this team",
      });
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

    if (teamLeaderId && Number(teamLeaderId) !== Number(req.user.id)) {
      await pool.query(
        `INSERT INTO team_members (team_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (team_id, user_id) DO NOTHING`,
        [req.params.teamId, teamLeaderId],
      );
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Team update error:", error.message);

    if (error.code === "23503") {
      return res.status(404).json({
        error: "Workspace, department, team leader, or user not found",
      });
    }

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Delete a Team
|--------------------------------------------------------------------------
*/

router.delete("/:teamId", authMiddleware, async (req, res) => {
  try {
    const teamResult = await pool.query(
      `SELECT
         id,
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

    if (team.workspace_id) {
      const leaderResult = await getTeamLeaderMembership(
        team.workspace_id,
        req.user.id,
      );

      if (
        leaderResult.rows.length === 0 ||
        !leaderResult.rows[0].has_team_leader_role
      ) {
        return res.status(403).json({
          error: "Only the Workspace Team Leader can delete this team",
        });
      }
    } else if (Number(team.created_by) !== Number(req.user.id)) {
      return res.status(403).json({
        error: "Only the team creator can delete this team",
      });
    }

    const result = await pool.query(
      `DELETE FROM teams
       WHERE id = $1
       RETURNING *`,
      [req.params.teamId],
    );

    return res.status(200).json({
      message: "Team deleted successfully",
      team: result.rows[0],
    });
  } catch (error) {
    console.error("Team deletion error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Add a Member to a Team
|--------------------------------------------------------------------------
*/

router.post("/:teamId/members", authMiddleware, async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: "User ID is required",
    });
  }

  try {
    const teamResult = await pool.query(
      `SELECT
         id,
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

    if (team.workspace_id) {
      const leaderResult = await getTeamLeaderMembership(
        team.workspace_id,
        req.user.id,
      );

      if (
        leaderResult.rows.length === 0 ||
        !leaderResult.rows[0].has_team_leader_role
      ) {
        return res.status(403).json({
          error: "Only the Workspace Team Leader can add members to this team",
        });
      }

      const workspaceMemberResult = await pool.query(
        `SELECT
           id,
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

      if (String(workspaceMemberResult.rows[0].role).toUpperCase() !== "USER") {
        return res.status(400).json({
          error: "Only workspace users can be added to this team",
        });
      }
    } else if (Number(team.created_by) !== Number(req.user.id)) {
      // Preserve legacy team behavior.
      return res.status(403).json({
        error: "Only the team creator can add members",
      });
    }

    const userResult = await pool.query(
      `SELECT id
       FROM users
       WHERE id = $1`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const result = await pool.query(
      `INSERT INTO team_members (team_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (team_id, user_id) DO NOTHING
       RETURNING *`,
      [req.params.teamId, userId],
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        error: "User is already a member of this team",
      });
    }

    return res.status(201).json(result.rows[0]);
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

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Remove a Member from a Team
|--------------------------------------------------------------------------
*/

router.delete("/:teamId/members/:userId", authMiddleware, async (req, res) => {
  try {
    const teamResult = await pool.query(
      `SELECT
           teams.id,
           teams.workspace_id,
           teams.created_by,
           teams.team_leader_id,
           workspaces.type AS workspace_type
         FROM teams
         LEFT JOIN workspaces
           ON teams.workspace_id = workspaces.id
         WHERE teams.id = $1`,
      [req.params.teamId],
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        error: "Team not found",
      });
    }

    const team = teamResult.rows[0];

    if (team.workspace_id) {
      const leaderResult = await getTeamLeaderMembership(
        team.workspace_id,
        req.user.id,
      );

      if (
        leaderResult.rows.length === 0 ||
        !leaderResult.rows[0].has_team_leader_role
      ) {
        return res.status(403).json({
          error:
            "Only the Workspace Team Leader can remove members from this team",
        });
      }

      const targetMemberResult = await pool.query(
        `SELECT role
           FROM workspace_members
           WHERE workspace_id = $1
             AND user_id = $2`,
        [team.workspace_id, req.params.userId],
      );

      if (targetMemberResult.rows.length > 0) {
        if (String(targetMemberResult.rows[0].role).toUpperCase() !== "USER") {
          return res.status(400).json({
            error: "Only workspace users can be removed from this team",
          });
        }

        if (
          team.workspace_type === "COMPANY" &&
          Number(team.team_leader_id ?? team.created_by) !== Number(req.user.id)
        ) {
          return res.status(403).json({
            error:
              "Only the Team Leader assigned to this team can remove its members",
          });
        }
      }
    } else if (Number(team.created_by) !== Number(req.user.id)) {
      return res.status(403).json({
        error: "Only the team creator can remove members",
      });
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

    return res.status(200).json({
      message: "Team member removed successfully",
      member: result.rows[0],
    });
  } catch (error) {
    console.error("Remove member error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Get a Single Team
|--------------------------------------------------------------------------
*/

router.get("/:teamId", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         teams.id,
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

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Single team fetch error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

module.exports = router;
