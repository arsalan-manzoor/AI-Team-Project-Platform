const pool = require("../config/db");
const { logProjectActivity } = require("../utils/projectActivity");

const SUPPORTED_WORKSPACE_TYPES = ["PROJECT", "COMPANY", "INDIVIDUAL"];

const TASK_STATUS_PROGRESS = {
  pending: 0,
  in_progress: 50,
  in_review: 80,
  completed: 100,
};

const TASK_STATUS_ORDER = {
  pending: 0,
  in_progress: 1,
  in_review: 2,
  completed: 3,
};

const ROLE_LEVELS = {
  USER: 1,
  TEAM_LEADER: 2,
  HR: 3,
  ADMIN: 4,
};

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function normalizeTaskStatus(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const aliases = {
    todo: "pending",
    to_do: "pending",
    inprogress: "in_progress",
    review: "in_review",
    complete: "completed",
  };

  const normalized = aliases[value] || value;

  return Object.prototype.hasOwnProperty.call(TASK_STATUS_PROGRESS, normalized)
    ? normalized
    : null;
}

function getProgressForStatus(status) {
  const normalized = normalizeTaskStatus(status);

  return normalized === null ? null : TASK_STATUS_PROGRESS[normalized];
}

function getRoleLevel(role) {
  return ROLE_LEVELS[normalizeRole(role)] || 0;
}

function getHighestRole(roles) {
  if (!roles || roles.size === 0) {
    return null;
  }

  return (
    [...roles].sort((a, b) => getRoleLevel(b) - getRoleLevel(a))[0] || null
  );
}

function sameId(first, second) {
  return (
    first !== null &&
    first !== undefined &&
    second !== null &&
    second !== undefined &&
    Number.isFinite(Number(first)) &&
    Number.isFinite(Number(second)) &&
    Number(first) === Number(second)
  );
}

function isForwardStatusChange(currentStatus, nextStatus) {
  return TASK_STATUS_ORDER[nextStatus] === TASK_STATUS_ORDER[currentStatus] + 1;
}

function isBackwardStatusChange(currentStatus, nextStatus) {
  return TASK_STATUS_ORDER[nextStatus] < TASK_STATUS_ORDER[currentStatus];
}

function hasHigherRole(actorRole, assignedUserRole) {
  return getRoleLevel(actorRole) > getRoleLevel(assignedUserRole);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeDeadlineForComparison(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function serviceError(message, status = 403) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function safelyLogTaskActivity(projectId, userId, action, description) {
  try {
    await logProjectActivity(projectId, userId, action, description);
  } catch (error) {
    console.error("AI task activity logging error:", error.message);
  }
}

async function getWorkspaceRoles(db, workspaceId, userId) {
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
 * Load project and workspace information.
 */
async function getProjectInformation(db, projectId) {
  const result = await db.query(
    `
        SELECT
            p.id,
            p.name,
            p.team_id,
            p.created_by,
            p.assigned_hr_user_id,

            COALESCE(
                p.workspace_id,
                t.workspace_id
            ) AS workspace_id,

            t.workspace_id AS team_workspace_id,
            t.team_leader_id,
            t.created_by AS team_created_by,

            w.type AS workspace_type,
            w.organization_id

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
 * Company task creation authorization.
 * Mirrors Arsalan's existing taskRoutes.js rules.
 */
async function canCreateCompanyTask(db, project, userId) {
  if (
    normalizeRole(project.workspace_type) !== "COMPANY" ||
    !project.workspace_id
  ) {
    return false;
  }

  const roles = await getWorkspaceRoles(db, project.workspace_id, userId);

  if (roles.size === 0) {
    return false;
  }

  if (roles.has("ADMIN")) {
    return true;
  }

  if (roles.has("HR")) {
    if (sameId(project.created_by, userId)) {
      return true;
    }

    if (sameId(project.assigned_hr_user_id, userId)) {
      const handoverResult = await db.query(
        `
                SELECT 1
                FROM project_members pm

                JOIN organization_hr_team_leader_assignments assignment
                  ON assignment.team_leader_user_id = pm.user_id

                WHERE pm.project_id = $1
                  AND UPPER(TRIM(pm.role::TEXT)) = 'TEAM_LEADER'
                  AND assignment.organization_id = $2
                  AND assignment.hr_user_id = $3

                LIMIT 1
                `,
        [project.id, project.organization_id, userId],
      );

      if (handoverResult.rows.length > 0) {
        return true;
      }
    }

    const hasAttachedTeam =
      project.team_id !== null && project.team_id !== undefined;

    const validTeamWorkspace =
      hasAttachedTeam &&
      sameId(project.team_workspace_id, project.workspace_id);

    if (validTeamWorkspace) {
      const result = await db.query(
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
        [project.team_id, project.workspace_id, userId],
      );

      if (result.rows.length > 0) {
        return true;
      }
    }
  }

  if (!roles.has("TEAM_LEADER")) {
    return false;
  }

  const hasAttachedTeam =
    project.team_id !== null && project.team_id !== undefined;

  if (!hasAttachedTeam) {
    return false;
  }

  if (!sameId(project.team_workspace_id, project.workspace_id)) {
    return false;
  }

  const responsibleTeamLeader =
    project.team_leader_id ?? project.team_created_by;

  return sameId(responsibleTeamLeader, userId);
}

/*
 * Workspace assignee validation.
 * Supports primary and additional workspace roles.
 */
async function validateWorkspaceAssignee(
  db,
  { workspaceId, projectId, teamId, userId },
) {
  const result = await db.query(
    `
        SELECT users.id

        FROM users

        JOIN workspace_members wm
          ON wm.workspace_id = $1
         AND wm.user_id = users.id

        LEFT JOIN team_members tm
          ON tm.team_id = $3
         AND tm.user_id = users.id

        LEFT JOIN project_members pm
          ON pm.project_id = $4
         AND pm.user_id = users.id

        WHERE users.id = $2

          AND UPPER(
              TRIM(users.account_status::TEXT)
          ) = 'ACTIVE'

          AND (
              UPPER(TRIM(wm.role::TEXT))
                  IN ('USER', 'TEAM_LEADER')

              OR EXISTS (
                  SELECT 1
                  FROM workspace_member_roles wmr
                  WHERE wmr.workspace_member_id = wm.id
                    AND UPPER(TRIM(wmr.role::TEXT))
                        IN ('USER', 'TEAM_LEADER')
              )
          )

          AND (
              tm.user_id IS NOT NULL

              OR (
                  pm.user_id IS NOT NULL
                  AND UPPER(TRIM(pm.role::TEXT))
                      IN ('USER', 'TEAM_LEADER')
              )
          )

        LIMIT 1
        `,
    [workspaceId, userId, teamId, projectId],
  );

  return result.rows.length > 0;
}

async function validateLegacyAssignee(db, teamId, userId) {
  const result = await db.query(
    `
        SELECT team_members.user_id

        FROM team_members

        JOIN users
          ON users.id = team_members.user_id

        WHERE team_members.team_id = $1
          AND team_members.user_id = $2
          AND UPPER(
              TRIM(users.account_status::TEXT)
          ) = 'ACTIVE'

        LIMIT 1
        `,
    [teamId, userId],
  );

  return result.rows.length > 0;
}

/*
 * Load all task, project, team and membership information
 * required for task authorization.
 */
async function getTaskAccessInformation(db, taskId, userId, lock = false) {
  const result = await db.query(
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
            tasks.progress,
            tasks.created_at,

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
            workspaces.organization_id,

            workspace_members.role AS workspace_role,

            assigned_workspace_members.role
                AS assigned_user_workspace_role,

            team_members.user_id
                AS team_member_user_id,

            actor_project_members.user_id
                AS actor_project_member_user_id,

            actor_project_members.role
                AS actor_project_member_role,

            assigned_project_members.user_id
                AS assigned_project_member_user_id,

            assigned_project_members.role
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

        LEFT JOIN workspace_members
          ON workspace_members.workspace_id = COALESCE(
              projects.workspace_id,
              teams.workspace_id
          )
         AND workspace_members.user_id = $2

        LEFT JOIN workspace_members AS assigned_workspace_members
          ON assigned_workspace_members.workspace_id = COALESCE(
              projects.workspace_id,
              teams.workspace_id
          )
         AND assigned_workspace_members.user_id = tasks.assigned_to

        LEFT JOIN team_members
          ON team_members.team_id = projects.team_id
         AND team_members.user_id = $2

        LEFT JOIN project_members AS actor_project_members
          ON actor_project_members.project_id = tasks.project_id
         AND actor_project_members.user_id = $2

        LEFT JOIN project_members AS assigned_project_members
          ON assigned_project_members.project_id = tasks.project_id
         AND assigned_project_members.user_id = tasks.assigned_to

        WHERE tasks.id = $1

        LIMIT 1
        ${lock ? "FOR UPDATE OF tasks" : ""}
        `,
    [taskId, userId],
  );

  return result.rows[0] || null;
}

/*
 * Company task visibility.
 */
async function canReadCompanyTask(task, userId, db = pool) {
  const roles = await getWorkspaceRoles(db, task.workspace_id, userId);

  if (roles.size === 0) {
    return false;
  }

  if (roles.has("ADMIN")) {
    return true;
  }

  const hasValidTeam =
    task.team_id !== null &&
    task.team_id !== undefined &&
    sameId(task.team_workspace_id, task.workspace_id);

  if (roles.has("HR")) {
    if (sameId(task.project_created_by, userId)) {
      return true;
    }

    if (sameId(task.assigned_hr_user_id, userId)) {
      return true;
    }

    if (task.organization_id) {
      const directAssignmentResult = await db.query(
        `
                SELECT 1
                FROM project_members pm

                JOIN organization_hr_team_leader_assignments assignment
                  ON assignment.team_leader_user_id = pm.user_id

                WHERE pm.project_id = $1
                  AND UPPER(TRIM(pm.role::TEXT)) = 'TEAM_LEADER'
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

  if (roles.has("TEAM_LEADER")) {
    const directProjectAssignment = await db.query(
      `
            SELECT 1
            FROM project_members
            WHERE project_id = $1
              AND user_id = $2
              AND UPPER(TRIM(role::TEXT)) = 'TEAM_LEADER'
            LIMIT 1
            `,
      [task.project_id, userId],
    );

    if (directProjectAssignment.rows.length > 0) {
      return true;
    }

    if (hasValidTeam) {
      const responsibleLeader = task.team_leader_id ?? task.team_created_by;

      if (sameId(responsibleLeader, userId)) {
        return true;
      }
    }
  }

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
 * General task visibility.
 */
async function canReadTask(task, userId, db = pool) {
  if (!task) {
    return false;
  }

  const assignedToUser = sameId(task.assigned_to, userId);

  const isTeamMember = sameId(task.team_member_user_id, userId);

  const isProjectMember = sameId(task.actor_project_member_user_id, userId);

  if (!task.workspace_id) {
    return isTeamMember || sameId(task.created_by, userId) || assignedToUser;
  }

  const workspaceType = normalizeRole(task.workspace_type);

  if (!SUPPORTED_WORKSPACE_TYPES.includes(workspaceType)) {
    return false;
  }

  if (workspaceType === "COMPANY") {
    return canReadCompanyTask(task, userId, db);
  }

  const roles = await getWorkspaceRoles(db, task.workspace_id, userId);

  if (roles.has("TEAM_LEADER") || roles.has("ADMIN") || roles.has("HR")) {
    return true;
  }

  if (roles.has("USER") && assignedToUser) {
    return true;
  }

  return assignedToUser && (isTeamMember || isProjectMember);
}

/*
 * Shared task-update authorization and execution.
 */
async function applyTaskUpdate(db, taskId, fields, userId) {
  const existingTask = await getTaskAccessInformation(db, taskId, userId, true);

  if (!existingTask) {
    throw serviceError("Task not found", 404);
  }

  const hasTaskAccess = await canReadTask(existingTask, userId, db);

  if (!hasTaskAccess) {
    throw serviceError("You are not authorized to update this task", 403);
  }

  const assignedToProvided = hasOwn(fields, "assignedTo");

  if (assignedToProvided) {
    const requestedAssignee =
      fields.assignedTo === null ||
      fields.assignedTo === undefined ||
      fields.assignedTo === ""
        ? null
        : Number(fields.assignedTo);

    const existingAssignee =
      existingTask.assigned_to === null ||
      existingTask.assigned_to === undefined
        ? null
        : Number(existingTask.assigned_to);

    if (requestedAssignee !== existingAssignee) {
      throw serviceError(
        "The task assignee cannot be changed after task creation",
        403,
      );
    }
  }

  const title = hasOwn(fields, "title")
    ? String(fields.title || "").trim()
    : existingTask.title;

  const description = hasOwn(fields, "description")
    ? fields.description || null
    : existingTask.description;

  const priority = hasOwn(fields, "priority")
    ? fields.priority || "medium"
    : existingTask.priority;

  const deadline = hasOwn(fields, "deadline")
    ? fields.deadline || null
    : existingTask.deadline;

  const requestedStatus = hasOwn(fields, "status")
    ? normalizeTaskStatus(fields.status)
    : normalizeTaskStatus(existingTask.status);

  const currentStatus = normalizeTaskStatus(existingTask.status);

  if (!title) {
    throw serviceError("Task title is required", 400);
  }

  if (!requestedStatus) {
    throw serviceError(
      "Invalid task status. Use To Do, In Progress, In Review, or Complete.",
      400,
    );
  }

  if (!currentStatus) {
    throw serviceError(
      "The existing task has an invalid status and cannot be updated.",
      400,
    );
  }

  const isWorkspaceTask = Boolean(existingTask.workspace_id);

  /*
   * LEGACY TASK:
   * Preserve creator-only modification.
   */
  if (!isWorkspaceTask) {
    if (!sameId(existingTask.created_by, userId)) {
      throw serviceError(
        "Only the task creator can update this legacy task",
        403,
      );
    }

    const result = await db.query(
      `
            UPDATE tasks
            SET
                title = $1,
                description = $2,
                status = $3,
                priority = $4,
                deadline = $5,
                progress = $6
            WHERE id = $7
            RETURNING *
            `,
      [
        title,
        description,
        requestedStatus,
        priority,
        deadline,
        getProgressForStatus(requestedStatus),
        existingTask.id,
      ],
    );

    if (result.rows.length === 0) {
      throw serviceError("Task not found", 404);
    }

    return {
      task: result.rows[0],
      activity: {
        action: "TASK_UPDATED",
        description: `Task "${title}" was updated`,
      },
    };
  }

  const isAssignee = sameId(existingTask.assigned_to, userId);

  /*
   * ASSIGNED USER:
   * Can edit their task and move forward one step.
   */
  if (isAssignee) {
    if (isBackwardStatusChange(currentStatus, requestedStatus)) {
      throw serviceError(
        "You cannot move your task backward. Ask a higher-role workspace member for authorization.",
        403,
      );
    }

    if (
      requestedStatus !== currentStatus &&
      !isForwardStatusChange(currentStatus, requestedStatus)
    ) {
      throw serviceError("Invalid task status transition", 400);
    }

    const result = await db.query(
      `
            UPDATE tasks
            SET
                title = $1,
                description = $2,
                status = $3,
                priority = $4,
                deadline = $5,
                progress = $6
            WHERE id = $7
            RETURNING *
            `,
      [
        title,
        description,
        requestedStatus,
        priority,
        deadline,
        getProgressForStatus(requestedStatus),
        existingTask.id,
      ],
    );

    if (result.rows.length === 0) {
      throw serviceError("Task not found", 404);
    }

    return {
      task: result.rows[0],
      activity: {
        action: "TASK_UPDATED",
        description: `Task "${title}" was updated`,
      },
    };
  }

  /*
   * HIGHER ROLE:
   * May authorize a backward status change only.
   */
  const actorRoles = await getWorkspaceRoles(
    db,
    existingTask.workspace_id,
    userId,
  );

  const assignedUserRoles =
    existingTask.assigned_to !== null && existingTask.assigned_to !== undefined
      ? await getWorkspaceRoles(
          db,
          existingTask.workspace_id,
          existingTask.assigned_to,
        )
      : new Set();

  const actorRole =
    getHighestRole(actorRoles) || normalizeRole(existingTask.workspace_role);

  const assignedUserRole =
    getHighestRole(assignedUserRoles) ||
    normalizeRole(
      existingTask.assigned_user_workspace_role ||
        existingTask.assigned_user_project_role ||
        "USER",
    );

  const actorHasHigherRole = hasHigherRole(actorRole, assignedUserRole);

  const isBackwardChange = isBackwardStatusChange(
    currentStatus,
    requestedStatus,
  );

  if (actorHasHigherRole && isBackwardChange) {
    const metadataChanged =
      title !== existingTask.title ||
      (description || null) !== (existingTask.description || null) ||
      priority !== existingTask.priority ||
      normalizeDeadlineForComparison(deadline) !==
        normalizeDeadlineForComparison(existingTask.deadline);

    if (metadataChanged) {
      throw serviceError(
        "A higher-role member may change task status backward, but cannot edit the assigned user's other task details.",
        403,
      );
    }

    const result = await db.query(
      `
            UPDATE tasks
            SET
                status = $1,
                progress = $2
            WHERE id = $3
            RETURNING *
            `,
      [requestedStatus, getProgressForStatus(requestedStatus), existingTask.id],
    );

    if (result.rows.length === 0) {
      throw serviceError("Task not found", 404);
    }

    return {
      task: result.rows[0],
      activity: {
        action: "TASK_STATUS_ROLLED_BACK",
        description: `Task "${existingTask.title}" status was moved backward to ${requestedStatus}`,
      },
    };
  }

  throw serviceError(
    "Only the assigned user can edit this task. A higher-role member may authorize a backward status change when permitted.",
    403,
  );
}

/*
 * CREATE TASK
 *
 * New tasks always start at pending / 0%.
 * Client or AI-supplied status/progress is ignored.
 */
async function createTask({
  title,
  description = null,
  projectId,
  assignedTo = null,
  priority = "medium",
  deadline = null,
  userId,
}) {
  const normalizedUserId = Number(userId);
  const normalizedProjectId = Number(projectId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw serviceError("Invalid user ID", 401);
  }

  if (
    typeof title !== "string" ||
    !title.trim() ||
    !Number.isInteger(normalizedProjectId) ||
    normalizedProjectId <= 0
  ) {
    throw serviceError("Task title and project ID are required", 400);
  }

  const normalizedAssignee =
    assignedTo === null || assignedTo === undefined || assignedTo === ""
      ? null
      : Number(assignedTo);

  if (
    normalizedAssignee !== null &&
    (!Number.isInteger(normalizedAssignee) || normalizedAssignee <= 0)
  ) {
    throw serviceError("Invalid assignee ID", 400);
  }

  const client = await pool.connect();

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const project = await getProjectInformation(client, normalizedProjectId);

    if (!project) {
      throw serviceError("Project not found", 404);
    }

    /*
     * VERIFY TASK CREATION PERMISSION
     */
    if (project.workspace_id) {
      const workspaceType = normalizeRole(project.workspace_type);

      if (workspaceType === "COMPANY") {
        const allowed = await canCreateCompanyTask(
          client,
          project,
          normalizedUserId,
        );

        if (!allowed) {
          throw serviceError(
            "You are not authorized to create tasks in this project",
            403,
          );
        }
      } else {
        const roles = await getWorkspaceRoles(
          client,
          project.workspace_id,
          normalizedUserId,
        );

        if (!roles.has("TEAM_LEADER")) {
          throw serviceError(
            "Only the Workspace Team Leader can create tasks",
            403,
          );
        }
      }
    } else {
      const memberResult = await client.query(
        `
                SELECT 1
                FROM team_members
                WHERE team_id = $1
                  AND user_id = $2
                LIMIT 1
                `,
        [project.team_id, normalizedUserId],
      );

      if (memberResult.rows.length === 0) {
        throw serviceError(
          "Project not found or you are not a team member",
          403,
        );
      }
    }

    /*
     * VALIDATE ASSIGNEE
     */
    if (normalizedAssignee !== null) {
      let eligible = false;

      if (project.workspace_id) {
        eligible = await validateWorkspaceAssignee(client, {
          workspaceId: project.workspace_id,
          projectId: normalizedProjectId,
          teamId: project.team_id,
          userId: normalizedAssignee,
        });
      } else {
        eligible = await validateLegacyAssignee(
          client,
          project.team_id,
          normalizedAssignee,
        );
      }

      if (!eligible) {
        throw serviceError(
          "The assignee must be an active USER or TEAM_LEADER who belongs to this project or its assigned team.",
          400,
        );
      }
    }

    const result = await client.query(
      `
            INSERT INTO tasks (
                title,
                description,
                project_id,
                assigned_to,
                created_by,
                status,
                priority,
                deadline,
                progress
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
            `,
      [
        title.trim(),
        description || null,
        normalizedProjectId,
        normalizedAssignee,
        normalizedUserId,
        "pending",
        priority || "medium",
        deadline || null,
        0,
      ],
    );

    const task = result.rows[0];

    if (
      normalizedAssignee !== null &&
      normalizedAssignee !== normalizedUserId
    ) {
      await client.query(
        `
                INSERT INTO notifications
                    (user_id, title, message)
                VALUES ($1, $2, $3)
                `,
        [
          normalizedAssignee,
          "New Task Assigned",
          `You have been assigned a new task: ${title.trim()}`,
        ],
      );
    }

    await client.query("COMMIT");
    transactionStarted = false;

    await safelyLogTaskActivity(
      normalizedProjectId,
      normalizedUserId,
      "TASK_CREATED",
      `Task "${task.title}" was created through the AI Assistant`,
    );

    return task;
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    throw error;
  } finally {
    client.release();
  }
}

/*
 * UPDATE TASK
 */
async function updateTask({
  taskId,
  title,
  description,
  assignedTo,
  status,
  priority,
  deadline,
  userId,
}) {
  const normalizedUserId = Number(userId);
  const normalizedTaskId = Number(taskId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw serviceError("Invalid user ID", 401);
  }

  if (!Number.isInteger(normalizedTaskId) || normalizedTaskId <= 0) {
    throw serviceError("Invalid task ID", 400);
  }

  const fields = {};

  if (title !== undefined) fields.title = title;
  if (description !== undefined) fields.description = description;
  if (assignedTo !== undefined) fields.assignedTo = assignedTo;
  if (status !== undefined) fields.status = status;
  if (priority !== undefined) fields.priority = priority;
  if (deadline !== undefined) fields.deadline = deadline;

  if (Object.keys(fields).length === 0) {
    throw serviceError(
      "At least one task field must be provided for update",
      400,
    );
  }

  const client = await pool.connect();

  let transactionStarted = false;
  let updateResult;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    updateResult = await applyTaskUpdate(
      client,
      normalizedTaskId,
      fields,
      normalizedUserId,
    );

    await client.query("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    throw error;
  } finally {
    client.release();
  }

  await safelyLogTaskActivity(
    updateResult.task.project_id,
    normalizedUserId,
    updateResult.activity.action,
    updateResult.activity.description,
  );

  return updateResult.task;
}

/*
 * DELETE TASK
 */
async function deleteTask({ taskId, userId }) {
  const normalizedUserId = Number(userId);
  const normalizedTaskId = Number(taskId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw serviceError("Invalid user ID", 401);
  }

  if (!Number.isInteger(normalizedTaskId) || normalizedTaskId <= 0) {
    throw serviceError("Invalid task ID", 400);
  }

  const client = await pool.connect();

  let transactionStarted = false;
  let deletedTask;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const task = await getTaskAccessInformation(
      client,
      normalizedTaskId,
      normalizedUserId,
      true,
    );

    if (!task) {
      throw serviceError("Task not found", 404);
    }

    const hasAccess = await canReadTask(task, normalizedUserId, client);

    if (!hasAccess) {
      throw serviceError("You are not authorized to delete this task", 403);
    }

    if (task.workspace_id) {
      const roles = await getWorkspaceRoles(
        client,
        task.workspace_id,
        normalizedUserId,
      );

      if (!roles.has("TEAM_LEADER")) {
        throw serviceError(
          "Only the Workspace Team Leader can delete this task",
          403,
        );
      }
    } else if (!sameId(task.created_by, normalizedUserId)) {
      throw serviceError(
        "Only the task creator can delete this legacy task",
        403,
      );
    }

    const result = await client.query(
      `
            DELETE FROM tasks
            WHERE id = $1
            RETURNING *
            `,
      [normalizedTaskId],
    );

    if (result.rows.length === 0) {
      throw serviceError("Task not found", 404);
    }

    deletedTask = result.rows[0];

    await client.query("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    throw error;
  } finally {
    client.release();
  }

  await safelyLogTaskActivity(
    deletedTask.project_id,
    normalizedUserId,
    "TASK_DELETED",
    `Task "${deletedTask.title}" was deleted through the AI Assistant`,
  );

  return deletedTask;
}

/*
 * BULK UPDATE TASKS
 *
 * Every task is independently authorized using the same rules
 * as updateTask(). The entire operation is atomic.
 */
async function bulkUpdateTasks({
  taskIds,
  status,
  priority,
  assignedTo,
  deadline,
  userId,
}) {
  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw serviceError("Invalid user ID", 401);
  }

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    throw serviceError("At least one task ID is required", 400);
  }

  const normalizedTaskIds = taskIds.map(Number);

  if (normalizedTaskIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw serviceError("All task IDs must be valid integers", 400);
  }

  const uniqueTaskIds = [...new Set(normalizedTaskIds)];

  const fields = {};

  if (status !== undefined) fields.status = status;
  if (priority !== undefined) fields.priority = priority;
  if (assignedTo !== undefined) fields.assignedTo = assignedTo;
  if (deadline !== undefined) fields.deadline = deadline;

  if (Object.keys(fields).length === 0) {
    throw serviceError(
      "At least one task field must be provided for update",
      400,
    );
  }

  const client = await pool.connect();

  let transactionStarted = false;
  const updates = [];

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    for (const taskId of uniqueTaskIds) {
      const result = await applyTaskUpdate(
        client,
        taskId,
        fields,
        normalizedUserId,
      );

      updates.push(result);
    }

    await client.query("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    throw error;
  } finally {
    client.release();
  }

  for (const update of updates) {
    await safelyLogTaskActivity(
      update.task.project_id,
      normalizedUserId,
      update.activity.action,
      update.activity.description,
    );
  }

  return updates.map((update) => update.task);
}

module.exports = {
  createTask,
  updateTask,
  deleteTask,
  bulkUpdateTasks,
};
