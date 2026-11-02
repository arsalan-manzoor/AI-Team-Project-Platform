const pool = require("../config/db");
const { logProjectActivity } = require("../utils/projectActivity");

const SUPPORTED_WORKSPACE_TYPES = ["PROJECT", "COMPANY", "INDIVIDUAL"];

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

async function getWorkspaceRoles(db, workspaceId, userId) {
  const result = await db.query(
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

async function getProjectContext(db, projectId) {
  const result = await db.query(
    `
        SELECT
            p.id,
            p.name,
            p.description,
            p.team_id,
            p.created_by,
            p.assigned_hr_user_id,
            COALESCE(p.workspace_id, t.workspace_id) AS workspace_id,
            t.workspace_id AS team_workspace_id,
            t.team_leader_id,
            t.created_by AS team_created_by,
            w.type AS workspace_type,
            w.organization_id

        FROM projects p

        LEFT JOIN teams t
          ON t.id = p.team_id

        LEFT JOIN workspaces w
          ON w.id = COALESCE(p.workspace_id, t.workspace_id)

        WHERE p.id = $1
        LIMIT 1
        `,
    [projectId],
  );

  return result.rows[0] || null;
}

/*
 * Matches the existing Company project visibility rules.
 */
async function canAccessCompanyProject(db, project, userId, roles) {
  if (roles.has("ADMIN")) {
    return true;
  }

  if (roles.has("HR")) {
    if (
      sameId(project.assigned_hr_user_id, userId) ||
      sameId(project.created_by, userId)
    ) {
      return true;
    }

    if (project.team_id && project.organization_id) {
      const result = await db.query(
        `
                SELECT 1
                FROM teams t
                JOIN organization_hr_team_leader_assignments a
                  ON a.organization_id = $3
                 AND a.hr_user_id = $2
                 AND a.team_leader_user_id =
                     COALESCE(t.team_leader_id, t.created_by)
                WHERE t.id = $1
                  AND t.workspace_id = $4
                LIMIT 1
                `,
        [
          project.team_id,
          userId,
          project.organization_id,
          project.workspace_id,
        ],
      );

      if (result.rows.length > 0) {
        return true;
      }
    }
  }

  if (roles.has("TEAM_LEADER") && project.team_id !== null) {
    const result = await db.query(
      `
            SELECT 1
            FROM teams
            WHERE id = $1
              AND workspace_id = $2
              AND COALESCE(team_leader_id, created_by) = $3
            LIMIT 1
            `,
      [project.team_id, project.workspace_id, userId],
    );

    if (result.rows.length > 0) {
      return true;
    }
  }

  // Preserve explicit team/project membership access.
  const membership = await db.query(
    `
        SELECT 1
        FROM team_members
        WHERE team_id = $1
          AND user_id = $2

        UNION

        SELECT 1
        FROM project_members
        WHERE project_id = $3
          AND user_id = $2
        LIMIT 1
        `,
    [project.team_id, userId, project.id],
  );

  return membership.rows.length > 0;
}

/*
 * Matches the existing project update/delete permission rules.
 */
async function authorizeProjectManagement(db, project, userId) {
  if (!project) {
    throw serviceError("Project not found", 404);
  }

  if (project.workspace_id !== null && project.workspace_id !== undefined) {
    const workspaceType = normalizeRole(project.workspace_type);

    if (!SUPPORTED_WORKSPACE_TYPES.includes(workspaceType)) {
      throw serviceError("Project access denied");
    }

    const roles = await getWorkspaceRoles(db, project.workspace_id, userId);

    if (!roles.has("TEAM_LEADER")) {
      throw serviceError("Project access denied");
    }

    if (workspaceType === "COMPANY") {
      const canAccess = await canAccessCompanyProject(
        db,
        project,
        userId,
        roles,
      );

      if (!canAccess) {
        throw serviceError("Project access denied");
      }
    }

    return;
  }

  // Legacy projects retain creator-only permissions.
  if (!sameId(project.created_by, userId)) {
    throw serviceError("Project access denied");
  }
}

/*
 * CREATE PROJECT
 */
async function createProject({ name, description = null, teamId, userId }) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw serviceError("Invalid user ID", 400);
  }

  if (
    typeof name !== "string" ||
    !name.trim() ||
    !Number.isInteger(teamId) ||
    teamId <= 0
  ) {
    throw serviceError("Project name and team ID are required", 400);
  }

  const teamResult = await pool.query(
    `
        SELECT
            t.id,
            t.workspace_id,
            w.type AS workspace_type
        FROM teams t
        LEFT JOIN workspaces w
          ON w.id = t.workspace_id
        WHERE t.id = $1
        LIMIT 1
        `,
    [teamId],
  );

  if (teamResult.rows.length === 0) {
    throw serviceError("Team not found", 404);
  }

  const team = teamResult.rows[0];

  if (team.workspace_id !== null) {
    const workspaceType = normalizeRole(team.workspace_type);

    if (!SUPPORTED_WORKSPACE_TYPES.includes(workspaceType)) {
      throw serviceError("Project access denied");
    }

    const membership = await pool.query(
      `
            SELECT
                wm.id,
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

            WHERE wm.workspace_id = $1
              AND wm.user_id = $2
            LIMIT 1
            `,
      [team.workspace_id, userId],
    );

    if (
      membership.rows.length === 0 ||
      !membership.rows[0].has_team_leader_role
    ) {
      throw serviceError("Project access denied");
    }
  } else {
    const membership = await pool.query(
      `
            SELECT 1
            FROM team_members
            WHERE team_id = $1
              AND user_id = $2
            LIMIT 1
            `,
      [teamId, userId],
    );

    if (membership.rows.length === 0) {
      throw serviceError("Project access denied");
    }
  }

  const result = await pool.query(
    `
        INSERT INTO projects (
            name,
            description,
            team_id,
            created_by
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
    [
      name.trim(),
      typeof description === "string" && description.trim()
        ? description.trim()
        : null,
      teamId,
      userId,
    ],
  );

  const project = result.rows[0];

  try {
    await logProjectActivity(
      project.id,
      userId,
      "PROJECT_CREATED",
      `Project "${project.name}" was created through the AI Assistant.`,
    );
  } catch (error) {
    console.error("AI project activity error:", error.message);
  }

  return project;
}

/*
 * UPDATE PROJECT
 */
async function updateProject({ projectId, name, description = null, userId }) {
  if (
    !Number.isInteger(userId) ||
    !Number.isInteger(projectId) ||
    projectId <= 0
  ) {
    throw serviceError("Invalid project ID", 400);
  }

  if (typeof name !== "string" || !name.trim()) {
    throw serviceError("Project name is required", 400);
  }

  const project = await getProjectContext(pool, projectId);

  await authorizeProjectManagement(pool, project, userId);

  const result = await pool.query(
    `
        UPDATE projects
        SET name = $1,
            description = $2
        WHERE id = $3
        RETURNING *
        `,
    [
      name.trim(),
      typeof description === "string" && description.trim()
        ? description.trim()
        : null,
      projectId,
    ],
  );

  if (result.rows.length === 0) {
    throw serviceError("Project not found", 404);
  }

  try {
    await logProjectActivity(
      projectId,
      userId,
      "PROJECT_UPDATED",
      `Project "${result.rows[0].name}" was updated through the AI Assistant.`,
    );
  } catch (error) {
    console.error("AI project activity error:", error.message);
  }

  return result.rows[0];
}

/*
 * DELETE PROJECT
 */
async function deleteProject({ projectId, userId }) {
  if (
    !Number.isInteger(userId) ||
    !Number.isInteger(projectId) ||
    projectId <= 0
  ) {
    throw serviceError("Invalid project ID", 400);
  }

  const client = await pool.connect();

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const locked = await client.query(
      `
            SELECT id
            FROM projects
            WHERE id = $1
            FOR UPDATE
            `,
      [projectId],
    );

    if (locked.rows.length === 0) {
      throw serviceError("Project not found", 404);
    }

    const project = await getProjectContext(client, projectId);

    await authorizeProjectManagement(client, project, userId);

    const result = await client.query(
      `
            DELETE FROM projects
            WHERE id = $1
            RETURNING *
            `,
      [projectId],
    );

    if (result.rows.length === 0) {
      throw serviceError("Project not found", 404);
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return result.rows[0];
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createProject,
  updateProject,
  deleteProject,
};
