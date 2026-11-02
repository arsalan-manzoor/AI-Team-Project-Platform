const pool = require("../config/db");

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function sameId(first, second) {
  return (
    first !== null &&
    first !== undefined &&
    second !== null &&
    second !== undefined &&
    Number(first) === Number(second)
  );
}

function serviceError(message, status = 403) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function getWorkspaceRoles(workspaceId, userId) {
  const result = await pool.query(
    `
        SELECT UPPER(TRIM(wm.role::TEXT)) AS role
        FROM workspace_members wm
        WHERE wm.workspace_id = $1
          AND wm.user_id = $2

        UNION

        SELECT UPPER(TRIM(wmr.role::TEXT)) AS role
        FROM workspace_member_roles wmr
        JOIN workspace_members wm
          ON wm.id = wmr.workspace_member_id
        WHERE wm.workspace_id = $1
          AND wm.user_id = $2
        `,
    [workspaceId, userId],
  );

  return new Set(result.rows.map((row) => normalizeRole(row.role)));
}

async function getProjectContext(projectId) {
  const result = await pool.query(
    `
        SELECT
            p.id,
            p.name,
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
          ON t.id = p.team_id

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
 * Matches the authorization model in milestoneRoutes.js.
 */
async function authorizeMilestoneManagement(project, userId) {
  if (!project) {
    throw serviceError("Project not found", 404);
  }

  const workspaceId = project.workspace_id;

  if (workspaceId) {
    const roles = await getWorkspaceRoles(workspaceId, userId);

    if (roles.size === 0) {
      throw serviceError("You are not a member of this workspace", 403);
    }

    const isIndependentCompanyProject =
      normalizeRole(project.workspace_type) === "COMPANY" && !project.team_id;

    if (isIndependentCompanyProject) {
      const isAdmin = roles.has("ADMIN");

      const isAssignedHR =
        roles.has("HR") && sameId(project.assigned_hr_user_id, userId);

      if (!isAdmin && !isAssignedHR) {
        throw serviceError(
          "You are not authorized to manage this project's milestones",
          403,
        );
      }

      return;
    }

    if (!roles.has("TEAM_LEADER")) {
      throw serviceError(
        "Only the Project Team Leader can manage milestones",
        403,
      );
    }

    return;
  }

  /*
   * Legacy Individual team-based project.
   * Preserve the existing team-member management rule.
   */
  if (project.team_id) {
    const result = await pool.query(
      `
            SELECT 1
            FROM team_members
            WHERE team_id = $1
              AND user_id = $2
            LIMIT 1
            `,
      [project.team_id, userId],
    );

    if (result.rows.length === 0) {
      throw serviceError("Project not found or you are not a team member", 404);
    }

    return;
  }

  throw serviceError("Project not found", 404);
}

async function createMilestone({
  name,
  description = null,
  projectId,
  deadline = null,
  status = "pending",
  userId,
}) {
  const normalizedUserId = Number(userId);
  const normalizedProjectId = Number(projectId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw serviceError("Invalid user ID", 401);
  }

  if (
    typeof name !== "string" ||
    !name.trim() ||
    !Number.isInteger(normalizedProjectId) ||
    normalizedProjectId <= 0
  ) {
    throw serviceError("Milestone name and project ID are required", 400);
  }

  const project = await getProjectContext(normalizedProjectId);

  await authorizeMilestoneManagement(project, normalizedUserId);

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

  return result.rows[0];
}

module.exports = {
  createMilestone,
};
