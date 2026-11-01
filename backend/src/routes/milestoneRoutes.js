const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| 1. GET PROJECT CONTEXT
|--------------------------------------------------------------------------
|
| Supports:
| - Independent Company projects (team_id = NULL)
| - Company projects attached to teams
| - Existing legacy team-based projects
|
*/

async function getProjectContext(projectId) {
  const result = await pool.query(
    `
      SELECT
        p.id,
        p.name,
        p.description,
        p.team_id,
        p.workspace_id AS project_workspace_id,
        p.assigned_hr_user_id,
        p.created_by,

        t.workspace_id AS team_workspace_id,

        COALESCE(
          p.workspace_id,
          t.workspace_id
        ) AS workspace_id,

        w.type AS workspace_type

      FROM projects p

      LEFT JOIN teams t
        ON p.team_id = t.id

      LEFT JOIN workspaces w
        ON w.id = COALESCE(
          p.workspace_id,
          t.workspace_id
        )

      WHERE p.id = $1

      LIMIT 1
    `,
    [projectId],
  );

  return result.rows[0] || null;
}

/*
|--------------------------------------------------------------------------
| 2. GET ALL ROLES OF A WORKSPACE MEMBER
|--------------------------------------------------------------------------
|
| Primary role:
| workspace_members.role
|
| Additional roles:
| workspace_member_roles.role
|
| IMPORTANT:
| workspace_member_roles connects through
| workspace_member_id = workspace_members.id.
|
*/

async function getWorkspaceRoles(workspaceId, userId) {
  const result = await pool.query(
    `
      SELECT
        UPPER(TRIM(wm.role::TEXT)) AS role

      FROM workspace_members wm

      WHERE wm.workspace_id = $1
        AND wm.user_id = $2

      UNION

      SELECT
        UPPER(TRIM(wmr.role::TEXT)) AS role

      FROM workspace_member_roles wmr

      JOIN workspace_members wm
        ON wm.id = wmr.workspace_member_id

      WHERE wm.workspace_id = $1
        AND wm.user_id = $2
    `,
    [workspaceId, userId],
  );

  return new Set(result.rows.map((row) => row.role));
}

/*
|--------------------------------------------------------------------------
| 3. CHECK PROJECT PERMISSIONS
|--------------------------------------------------------------------------
|
| INDEPENDENT COMPANY PROJECT
|
| ADMIN:
| - Can view milestones.
| - Can create milestones.
| - Can update milestones.
| - Can delete milestones.
|
| ASSIGNED HR:
| - Can view milestones.
| - Can create milestones.
| - Can update milestones.
| - Can delete milestones.
|
| TEAM_LEADER:
| - Can view independent projects.
| - Cannot manage milestones until the project
|   is attached to a team or delegated.
|
| TEAM-BASED COMPANY PROJECT
|
| - Workspace members can view milestones.
| - Team Leaders can manage milestones.
|
| LEGACY PROJECT
|
| - Existing team membership behavior is retained.
|
*/

async function getProjectPermissions(project, userId) {
  const workspaceId = project.workspace_id;

  /*
   * WORKSPACE PROJECT
   */

  if (workspaceId) {
    const roles = await getWorkspaceRoles(workspaceId, userId);

    if (roles.size === 0) {
      return {
        canView: false,
        canManage: false,
        status: 403,
        error: "You are not a member of this workspace",
      };
    }

    /*
     * INDEPENDENT COMPANY PROJECT
     */

    const isIndependentCompanyProject =
      project.workspace_type === "COMPANY" && !project.team_id;

    if (isIndependentCompanyProject) {
      const isAdmin = roles.has("ADMIN");

      const isAssignedHR =
        roles.has("HR") &&
        Number(project.assigned_hr_user_id) === Number(userId);

      const isTeamLeader = roles.has("TEAM_LEADER");

      return {
        canView: isAdmin || isAssignedHR || isTeamLeader,

        canManage: isAdmin || isAssignedHR,

        status: 403,

        error: "You are not authorized to manage this project's milestones",
      };
    }

    /*
     * TEAM-BASED WORKSPACE PROJECT
     */

    return {
      canView: true,

      canManage: roles.has("TEAM_LEADER"),

      status: 403,

      error: "Only the Project Team Leader can manage milestones",
    };
  }

  /*
   * LEGACY TEAM PROJECT
   */

  if (project.team_id) {
    const teamMemberResult = await pool.query(
      `
        SELECT id

        FROM team_members

        WHERE team_id = $1
          AND user_id = $2

        LIMIT 1
      `,
      [project.team_id, userId],
    );

    if (teamMemberResult.rows.length === 0) {
      return {
        canView: false,
        canManage: false,
        status: 404,
        error: "Project not found or you are not a team member",
      };
    }

    /*
     * Preserve the previous legacy behavior:
     * team members can manage milestones.
     */

    return {
      canView: true,
      canManage: true,
    };
  }

  return {
    canView: false,
    canManage: false,
    status: 404,
    error: "Project not found",
  };
}

/*
|--------------------------------------------------------------------------
| 4. AUTHORIZE PROJECT ACCESS
|--------------------------------------------------------------------------
*/

async function authorizeProject(project, userId, res, requireManage = false) {
  const permissions = await getProjectPermissions(project, userId);

  if (!permissions.canView) {
    res.status(permissions.status || 403).json({
      error: permissions.error || "Access denied",
    });

    return false;
  }

  if (requireManage && !permissions.canManage) {
    res.status(403).json({
      error: permissions.error || "You are not authorized to manage milestones",
    });

    return false;
  }

  return true;
}

/*
|--------------------------------------------------------------------------
| 5. CREATE MILESTONE
|--------------------------------------------------------------------------
|
| POST /api/milestones
|
*/

router.post("/", authMiddleware, async (req, res) => {
  const { name, description, projectId, deadline, status } = req.body || {};

  const normalizedProjectId = Number(projectId);

  if (
    typeof name !== "string" ||
    !name.trim() ||
    !Number.isInteger(normalizedProjectId) ||
    normalizedProjectId <= 0
  ) {
    return res.status(400).json({
      error: "Milestone name and valid project ID are required",
    });
  }

  try {
    const project = await getProjectContext(normalizedProjectId);

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const authorized = await authorizeProject(project, req.user.id, res, true);

    if (!authorized) {
      return;
    }

    const result = await pool.query(
      `
        INSERT INTO milestones (
          name,
          description,
          project_id,
          deadline,
          status
        )

        VALUES ($1, $2, $3, $4, $5)

        RETURNING *
      `,
      [
        name.trim(),
        description || null,
        normalizedProjectId,
        deadline || null,
        status || "pending",
      ],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Milestone creation database error:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| 6. GET MILESTONES FOR PROJECT
|--------------------------------------------------------------------------
|
| GET /api/milestones/project/:projectId
|
*/

router.get("/project/:projectId", authMiddleware, async (req, res) => {
  const projectId = Number(req.params.projectId);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return res.status(400).json({
      error: "Invalid project ID",
    });
  }

  try {
    const project = await getProjectContext(projectId);

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const authorized = await authorizeProject(project, req.user.id, res);

    if (!authorized) {
      return;
    }

    const result = await pool.query(
      `
          SELECT
            id,
            name,
            description,
            project_id,
            deadline,
            status,
            created_at

          FROM milestones

          WHERE project_id = $1

          ORDER BY id
        `,
      [projectId],
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Milestone fetch database error:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| 7. UPDATE MILESTONE
|--------------------------------------------------------------------------
|
| PUT /api/milestones/:id
|
*/

router.put("/:id", authMiddleware, async (req, res) => {
  const { name, description, deadline, status } = req.body || {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      error: "Milestone name is required",
    });
  }

  try {
    /*
     * Find milestone.
     */

    const milestoneResult = await pool.query(
      `
        SELECT
          id,
          project_id

        FROM milestones

        WHERE id = $1

        LIMIT 1
      `,
      [req.params.id],
    );

    if (milestoneResult.rows.length === 0) {
      return res.status(404).json({
        error: "Milestone not found",
      });
    }

    const milestone = milestoneResult.rows[0];

    /*
     * Get project context without requiring a team.
     */

    const project = await getProjectContext(milestone.project_id);

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const authorized = await authorizeProject(project, req.user.id, res, true);

    if (!authorized) {
      return;
    }

    /*
     * Update milestone.
     */

    const result = await pool.query(
      `
        UPDATE milestones

        SET
          name = $1,
          description = $2,
          deadline = $3,
          status = $4

        WHERE id = $5

        RETURNING *
      `,
      [
        name.trim(),
        description || null,
        deadline || null,
        status || "pending",
        req.params.id,
      ],
    );

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Milestone update database error:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| 8. DELETE MILESTONE
|--------------------------------------------------------------------------
|
| DELETE /api/milestones/:id
|
*/

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    /*
     * Find milestone.
     */

    const milestoneResult = await pool.query(
      `
          SELECT
            id,
            project_id

          FROM milestones

          WHERE id = $1

          LIMIT 1
        `,
      [req.params.id],
    );

    if (milestoneResult.rows.length === 0) {
      return res.status(404).json({
        error: "Milestone not found",
      });
    }

    const milestone = milestoneResult.rows[0];

    /*
     * Get project context.
     */

    const project = await getProjectContext(milestone.project_id);

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const authorized = await authorizeProject(project, req.user.id, res, true);

    if (!authorized) {
      return;
    }

    /*
     * Delete milestone.
     */

    const result = await pool.query(
      `
          DELETE FROM milestones

          WHERE id = $1

          RETURNING *
        `,
      [req.params.id],
    );

    return res.status(200).json({
      message: "Milestone deleted successfully",
      milestone: result.rows[0],
    });
  } catch (error) {
    console.error("Milestone deletion database error:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });

    return res.status(500).json({
      error: "Database error",
    });
  }
});

module.exports = router;
