const pool = require("../config/db");

const SUPPORTED_WORKSPACE_TYPES = ["PROJECT", "COMPANY", "INDIVIDUAL"];

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function sameId(first, second) {
  if (
    first === null ||
    first === undefined ||
    second === null ||
    second === undefined ||
    first === "" ||
    second === ""
  ) {
    return false;
  }

  return Number(first) === Number(second);
}

/*
 * Get every role assigned to the user in a workspace.
 * Supports both primary and additional workspace roles.
 */
async function getWorkspaceRoles(db, workspaceId, userId) {
  if (!workspaceId || !userId) {
    return new Set();
  }

  const result = await db.query(
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

  return new Set(
    result.rows.map((row) => normalizeRole(row.role)).filter(Boolean),
  );
}

/*
 * COMPANY WORKSPACE TASK VISIBILITY
 *
 * Uses the same authorization rules as taskRoutes.js.
 */
async function canReadCompanyTask(task, userId, db = pool) {
  const roles = await getWorkspaceRoles(db, task.workspace_id, userId);

  if (roles.size === 0) {
    return false;
  }

  // ADMIN can access all tasks in the workspace.
  if (roles.has("ADMIN")) {
    return true;
  }

  const hasValidTeam =
    task.team_id !== null &&
    task.team_id !== undefined &&
    sameId(task.team_workspace_id, task.workspace_id);

  /*
   * HR VISIBILITY
   */

  if (roles.has("HR")) {
    // Projects created by this HR.
    if (sameId(task.project_created_by, userId)) {
      return true;
    }

    // Projects directly assigned to this HR.
    if (sameId(task.assigned_hr_user_id, userId)) {
      return true;
    }

    /*
     * Projects assigned to reporting Team Leaders.
     */
    if (task.organization_id) {
      const directAssignmentResult = await db.query(
        `
                SELECT 1
                FROM project_members pm

                JOIN organization_hr_team_leader_assignments assignment
                  ON assignment.team_leader_user_id = pm.user_id

                WHERE pm.project_id = $1

                  AND UPPER(
                      TRIM(pm.role::TEXT)
                  ) = 'TEAM_LEADER'

                  AND assignment.organization_id = $2
                  AND assignment.hr_user_id = $3

                LIMIT 1
                `,
        [task.project_id, task.organization_id, userId],
      );

      if (directAssignmentResult.rows.length > 0) {
        return true;
      }
    }

    /*
     * Tasks belonging to teams managed by
     * the HR's assigned Team Leaders.
     */
    if (hasValidTeam && task.organization_id) {
      const teamAssignmentResult = await db.query(
        `
                SELECT 1

                FROM teams company_team

                JOIN workspaces company_workspace
                  ON company_workspace.id = company_team.workspace_id

                JOIN organization_hr_team_leader_assignments assignment
                  ON assignment.team_leader_user_id =
                    COALESCE(
                        company_team.team_leader_id,
                        company_team.created_by
                    )

                WHERE company_team.id = $1

                  AND company_team.workspace_id = $2

                  AND assignment.organization_id =
                    company_workspace.organization_id

                  AND assignment.hr_user_id = $3

                  AND UPPER(
                      TRIM(company_workspace.type::TEXT)
                  ) = 'COMPANY'

                LIMIT 1
                `,
        [task.team_id, task.workspace_id, userId],
      );

      if (teamAssignmentResult.rows.length > 0) {
        return true;
      }
    }
  }

  /*
   * TEAM LEADER VISIBILITY
   */

  if (roles.has("TEAM_LEADER")) {
    // Directly assigned project.
    const directProjectAssignment = await db.query(
      `
            SELECT 1
            FROM project_members
            WHERE project_id = $1
              AND user_id = $2

              AND UPPER(
                  TRIM(role::TEXT)
              ) = 'TEAM_LEADER'

            LIMIT 1
            `,
      [task.project_id, userId],
    );

    if (directProjectAssignment.rows.length > 0) {
      return true;
    }

    // Projects associated with the Team Leader's team.
    if (hasValidTeam) {
      const responsibleLeader = task.team_leader_id ?? task.team_created_by;

      if (sameId(responsibleLeader, userId)) {
        return true;
      }
    }
  }

  /*
   * REGULAR USER VISIBILITY
   */

  if (roles.has("USER")) {
    if (!sameId(task.assigned_to, userId)) {
      return false;
    }

    return (
      sameId(task.team_member_user_id, userId) ||
      sameId(task.actor_project_member_user_id, userId)
    );
  }

  return false;
}

/*
 * GENERAL TASK READ PERMISSIONS
 *
 * Supports:
 * 1. Legacy projects.
 * 2. Company workspaces.
 * 3. Individual workspaces.
 * 4. Project workspaces.
 */
async function canReadTask(task, userId, db = pool) {
  if (!task) {
    return false;
  }

  const assignedToUser = sameId(task.assigned_to, userId);

  const isTeamMember = sameId(task.team_member_user_id, userId);

  const isProjectMember = sameId(task.actor_project_member_user_id, userId);

  const workspaceId = task.workspace_id;

  // LEGACY PROJECT
  if (!workspaceId) {
    return isTeamMember || sameId(task.created_by, userId) || assignedToUser;
  }

  const workspaceType = normalizeRole(task.workspace_type);

  if (!SUPPORTED_WORKSPACE_TYPES.includes(workspaceType)) {
    return false;
  }

  // COMPANY WORKSPACE
  if (workspaceType === "COMPANY") {
    return canReadCompanyTask(task, userId, db);
  }

  // INDIVIDUAL / PROJECT WORKSPACE
  const roles = await getWorkspaceRoles(db, workspaceId, userId);

  if (roles.has("TEAM_LEADER") || roles.has("ADMIN") || roles.has("HR")) {
    return true;
  }

  if (roles.has("USER") && assignedToUser) {
    return true;
  }

  if (assignedToUser && (isTeamMember || isProjectMember)) {
    return true;
  }

  return false;
}

/*
 * Remove internal authorization fields.
 * Matches publicTask() in taskRoutes.js.
 */
function publicTask(task) {
  const {
    team_id,
    workspace_id,
    workspace_type,
    workspace_role,

    assigned_user_workspace_role,

    team_member_user_id,

    actor_project_member_user_id,
    actor_project_member_role,

    assigned_project_member_user_id,
    assigned_user_project_role,

    project_created_by,
    assigned_hr_user_id,

    team_workspace_id,
    team_leader_id,
    team_created_by,

    organization_id,

    ...result
  } = task;

  return result;
}

/*
 * Retrieve authorized tasks for the authenticated user.
 *
 * Optional projectId filters the results to one project.
 */
async function getTaskListContext(userId, projectId = null) {
  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    const error = new Error("Authenticated user ID must be a valid integer");
    error.status = 401;
    throw error;
  }

  let normalizedProjectId = null;

  if (projectId !== undefined && projectId !== null && projectId !== "") {
    normalizedProjectId = Number(projectId);

    if (!Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
      const error = new Error("Invalid project ID");
      error.status = 400;
      throw error;
    }
  }

  const result = await pool.query(
    `
        SELECT
            tasks.id,
            tasks.title,
            tasks.description,
            tasks.project_id,
            tasks.assigned_to,
            tasks.created_by,
            tasks.status,
            tasks.priority,
            tasks.deadline,
            tasks.created_at,
            tasks.progress,

            projects.team_id,
            projects.created_by AS project_created_by,
            projects.assigned_hr_user_id,

            teams.workspace_id AS team_workspace_id,
            teams.team_leader_id,
            teams.created_by AS team_created_by,

            COALESCE(
                projects.workspace_id,
                teams.workspace_id
            ) AS workspace_id,

            workspaces.type AS workspace_type,
            workspaces.organization_id AS organization_id,

            actor_workspace_member.role AS workspace_role,

            assigned_workspace_member.role
                AS assigned_user_workspace_role,

            actor_team_member.user_id
                AS team_member_user_id,

            actor_project_member.user_id
                AS actor_project_member_user_id,

            actor_project_member.role
                AS actor_project_member_role,

            assigned_project_member.user_id
                AS assigned_project_member_user_id,

            assigned_project_member.role
                AS assigned_user_project_role

        FROM tasks

        JOIN projects
          ON projects.id = tasks.project_id

        LEFT JOIN teams
          ON teams.id = projects.team_id

        LEFT JOIN workspaces
          ON workspaces.id = COALESCE(
              projects.workspace_id,
              teams.workspace_id
          )

        LEFT JOIN workspace_members actor_workspace_member
          ON actor_workspace_member.workspace_id = COALESCE(
              projects.workspace_id,
              teams.workspace_id
          )
          AND actor_workspace_member.user_id = $1

        LEFT JOIN workspace_members assigned_workspace_member
          ON assigned_workspace_member.workspace_id = COALESCE(
              projects.workspace_id,
              teams.workspace_id
          )
          AND assigned_workspace_member.user_id = tasks.assigned_to

        LEFT JOIN team_members actor_team_member
          ON actor_team_member.team_id = projects.team_id
          AND actor_team_member.user_id = $1

        LEFT JOIN project_members actor_project_member
          ON actor_project_member.project_id = projects.id
          AND actor_project_member.user_id = $1

        LEFT JOIN project_members assigned_project_member
          ON assigned_project_member.project_id = projects.id
          AND assigned_project_member.user_id = tasks.assigned_to

        WHERE
        (
            (
                COALESCE(
                    projects.workspace_id,
                    teams.workspace_id
                ) IS NOT NULL

                AND EXISTS (
                    SELECT 1
                    FROM workspace_members wm

                    WHERE wm.workspace_id = COALESCE(
                        projects.workspace_id,
                        teams.workspace_id
                    )

                    AND wm.user_id = $1
                )
            )

            OR

            (
                COALESCE(
                    projects.workspace_id,
                    teams.workspace_id
                ) IS NULL

                AND projects.team_id IS NOT NULL

                AND EXISTS (
                    SELECT 1
                    FROM team_members tm

                    WHERE tm.team_id = projects.team_id
                      AND tm.user_id = $1
                )
            )
        )

        AND (
            $2::integer IS NULL
            OR tasks.project_id = $2
        )

        ORDER BY
            tasks.created_at DESC NULLS LAST,
            tasks.id DESC
        `,
    [normalizedUserId, normalizedProjectId],
  );

  /*
   * Enforce the same detailed permissions as taskRoutes.js.
   */
  const accessibleTasks = [];

  for (const task of result.rows) {
    const allowed = await canReadTask(task, normalizedUserId, pool);

    if (allowed) {
      accessibleTasks.push(publicTask(task));
    }
  }

  return {
    tasks: accessibleTasks,
  };
}

module.exports = {
  getTaskListContext,
};
