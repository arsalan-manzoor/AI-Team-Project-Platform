const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const { logProjectActivity } = require("../utils/projectActivity");

const router = express.Router();

/* ============================================================
   SUPPORTED WORKSPACES
============================================================ */

const SUPPORTED_WORKSPACE_TYPES = ["PROJECT", "COMPANY", "INDIVIDUAL"];

/* ============================================================
   TASK STATUS AND PROGRESS
============================================================ */

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

/* ============================================================
   NORMALIZATION HELPERS
============================================================ */

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function normalizeTaskStatus(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  const aliases = {
    todo: "pending",
    to_do: "pending",
    pending: "pending",

    inprogress: "in_progress",
    in_progress: "in_progress",

    inreview: "in_review",
    in_review: "in_review",

    complete: "completed",
    completed: "completed",
    done: "completed",
  };

  return aliases[value] || null;
}

function getProgressForStatus(status) {
  const normalizedStatus = normalizeTaskStatus(status);

  if (!normalizedStatus) {
    return null;
  }

  return TASK_STATUS_PROGRESS[normalizedStatus];
}

function getRoleLevel(role) {
  return ROLE_LEVELS[normalizeRole(role)] || 0;
}

function getHighestRole(roles) {
  if (!roles || roles.size === 0) {
    return "";
  }

  return Array.from(roles).sort(
    (first, second) => getRoleLevel(second) - getRoleLevel(first),
  )[0];
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

function isForwardStatusChange(currentStatus, nextStatus) {
  const current = normalizeTaskStatus(currentStatus);
  const next = normalizeTaskStatus(nextStatus);

  if (!current || !next) {
    return false;
  }

  return TASK_STATUS_ORDER[next] > TASK_STATUS_ORDER[current];
}

function isBackwardStatusChange(currentStatus, nextStatus) {
  const current = normalizeTaskStatus(currentStatus);
  const next = normalizeTaskStatus(nextStatus);

  if (!current || !next) {
    return false;
  }

  return TASK_STATUS_ORDER[next] < TASK_STATUS_ORDER[current];
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

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

/* ============================================================
   ACTIVITY LOGGING
============================================================ */

async function safelyLogTaskActivity(
  projectId,
  userId,
  activityType,
  description,
) {
  try {
    await logProjectActivity(projectId, userId, activityType, description);
  } catch (error) {
    console.error("Task activity logging error:", error.message);
  }
}

/* ============================================================
   PROJECT INFORMATION
============================================================ */

async function getProjectInformation(projectId, db = pool) {
  const result = await db.query(
    `
      SELECT
        projects.id,
        projects.name,
        projects.team_id,
        projects.workspace_id AS project_workspace_id,
        projects.created_by,
        projects.assigned_hr_user_id,

        teams.workspace_id AS team_workspace_id,
        teams.team_leader_id AS team_leader_id,
        teams.created_by AS team_created_by,

        COALESCE(
          projects.workspace_id,
          teams.workspace_id
        ) AS workspace_id,

        workspaces.type AS workspace_type,
        workspaces.organization_id AS organization_id

      FROM projects

      LEFT JOIN teams
        ON teams.id = projects.team_id

      LEFT JOIN workspaces
        ON workspaces.id = COALESCE(
          projects.workspace_id,
          teams.workspace_id
        )

      WHERE projects.id = $1

      LIMIT 1
    `,
    [projectId],
  );

  return result.rows[0] || null;
}

/* ============================================================
   WORKSPACE ROLE LOOKUP
============================================================ */

/*
 * Supports:
 *
 * 1. workspace_members.role
 * 2. workspace_member_roles
 *
 * This is important because ZYRA supports multiple roles
 * within one workspace membership.
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

/* ============================================================
   REPORTING RELATIONSHIP HELPERS
============================================================ */

/*
 * Returns the Team Leaders assigned to an HR employee.
 */

async function getAssignedTeamLeaderIds(db, organizationId, hrUserId) {
  if (!organizationId || !hrUserId) {
    return [];
  }

  const result = await db.query(
    `
      SELECT DISTINCT
        team_leader_user_id

      FROM organization_hr_team_leader_assignments

      WHERE organization_id = $1
        AND hr_user_id = $2
    `,
    [organizationId, hrUserId],
  );

  return result.rows.map((row) => Number(row.team_leader_user_id));
}

/*
 * Returns Users assigned to a particular Team Leader.
 */

async function getAssignedUserIds(db, organizationId, teamLeaderUserId) {
  if (!organizationId || !teamLeaderUserId) {
    return [];
  }

  const result = await db.query(
    `
      SELECT DISTINCT
        user_id

      FROM organization_team_leader_user_assignments

      WHERE organization_id = $1
        AND team_leader_user_id = $2
    `,
    [organizationId, teamLeaderUserId],
  );

  return result.rows.map((row) => Number(row.user_id));
}

/*
 * Check whether a Team Leader reports to a particular HR.
 */

async function isTeamLeaderAssignedToHR(
  db,
  organizationId,
  hrUserId,
  teamLeaderUserId,
) {
  const result = await db.query(
    `
      SELECT 1

      FROM organization_hr_team_leader_assignments

      WHERE organization_id = $1
        AND hr_user_id = $2
        AND team_leader_user_id = $3

      LIMIT 1
    `,
    [organizationId, hrUserId, teamLeaderUserId],
  );

  return result.rows.length > 0;
}

/* ============================================================
   COMPANY TASK CREATION AUTHORIZATION
============================================================ */

/*
 * COMPANY TASK CREATION RULES
 *
 * ADMIN:
 * Can create tasks in every Company project.
 *
 * HR:
 * Can create tasks in:
 *
 * 1. Projects created by that HR.
 * 2. Projects assigned to that HR by ADMIN,
 *    but only after the project is handed over to
 *    one of that HR's assigned Team Leaders.
 * 3. Projects belonging to teams managed by
 *    Team Leaders assigned to that HR.
 *
 * TEAM_LEADER:
 * Can create tasks only when:
 *
 * 1. The project is attached to a team.
 * 2. The team belongs to the same workspace.
 * 3. The requester has TEAM_LEADER workspace role.
 * 4. The requester is responsible for that team.
 *
 * USER:
 * Cannot create tasks.
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

  /* --------------------------------------------------------
     ADMIN
  -------------------------------------------------------- */

  if (roles.has("ADMIN")) {
    return true;
  }

  /* --------------------------------------------------------
     HR
  -------------------------------------------------------- */

  if (roles.has("HR")) {
    /*
     * RULE 1:
     * HR can create tasks in projects originally created by HR.
     */

    if (sameId(project.created_by, userId)) {
      return true;
    }

    /*
     * RULE 2:
     * ADMIN-assigned projects become available for HR task
     * creation only after they have been handed over to
     * one of that HR's assigned Team Leaders.
     */

    if (sameId(project.assigned_hr_user_id, userId)) {
      const handoverResult = await db.query(
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
        [project.id, project.organization_id, userId],
      );

      if (handoverResult.rows.length > 0) {
        return true;
      }
    }

    /*
     * RULE 3:
     * HR can create tasks in projects attached to teams
     * managed by Team Leaders assigned to that HR.
     */

    const hasAttachedTeam =
      project.team_id !== null && project.team_id !== undefined;

    const hasValidTeamWorkspace =
      hasAttachedTeam &&
      sameId(project.team_workspace_id, project.workspace_id);

    if (hasValidTeamWorkspace) {
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

  /* --------------------------------------------------------
     TEAM LEADER
  -------------------------------------------------------- */

  if (!roles.has("TEAM_LEADER")) {
    return false;
  }

  /*
   * A Team Leader cannot create tasks in an independent
   * project before attaching it to a team.
   */

  const hasAttachedTeam =
    project.team_id !== null && project.team_id !== undefined;

  if (!hasAttachedTeam) {
    return false;
  }

  /*
   * Team must belong to the same workspace.
   */

  if (!sameId(project.team_workspace_id, project.workspace_id)) {
    return false;
  }

  /*
   * Only the responsible Team Leader can create tasks.
   */

  const responsibleTeamLeader =
    project.team_leader_id ?? project.team_created_by;

  return sameId(responsibleTeamLeader, userId);
}

/* ============================================================
   ASSIGNEE VALIDATION
============================================================ */

/*
 * Active USER or TEAM_LEADER must:
 *
 * 1. Belong to the same workspace.
 * 2. Have USER or TEAM_LEADER as a base or additional role.
 * 3. Belong to the team or project.
 *
 * HR and ADMIN cannot be selected as ordinary task assignees
 * through this validation.
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

          UPPER(
            TRIM(wm.role::TEXT)
          ) IN ('USER', 'TEAM_LEADER')

          OR EXISTS (
            SELECT 1

            FROM workspace_member_roles wmr

            WHERE wmr.workspace_member_id = wm.id

              AND UPPER(
                TRIM(wmr.role::TEXT)
              ) IN ('USER', 'TEAM_LEADER')
          )
        )

        AND (
          tm.user_id IS NOT NULL

          OR (
            pm.user_id IS NOT NULL

            AND UPPER(
              TRIM(pm.role::TEXT)
            ) IN ('USER', 'TEAM_LEADER')
          )
        )

      LIMIT 1
    `,
    [workspaceId, userId, teamId, projectId],
  );

  return result.rows.length > 0;
}

/* ============================================================
   LEGACY ASSIGNEE VALIDATION
============================================================ */

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

/* ============================================================
   TASK ACCESS INFORMATION
============================================================ */

async function getTaskAccessInformation(taskId, userId, db = pool) {
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
    `,
    [taskId, userId],
  );

  return result.rows[0] || null;
}

/* ============================================================
   COMPANY TASK READ PERMISSIONS
============================================================ */

/*
 * ADMIN:
 * All Company Workspace tasks.
 *
 * HR:
 * 1. Tasks in projects created by that HR.
 * 2. Tasks in projects assigned to that HR.
 * 3. Tasks in projects directly assigned to Team Leaders
 *    who report to that HR.
 * 4. Tasks in teams managed by Team Leaders who report
 *    to that HR.
 *
 * TEAM_LEADER:
 * 1. Tasks in projects directly assigned to that Team Leader.
 * 2. Tasks in teams managed by that Team Leader.
 *
 * USER:
 * Only their own assigned tasks in accessible projects.
 */

async function canReadCompanyTask(task, userId, db = pool) {
  const roles = await getWorkspaceRoles(db, task.workspace_id, userId);

  if (roles.size === 0) {
    return false;
  }

  /* ADMIN */

  if (roles.has("ADMIN")) {
    return true;
  }

  const hasValidTeam =
    task.team_id !== null &&
    task.team_id !== undefined &&
    sameId(task.team_workspace_id, task.workspace_id);

  /* ========================================================
     HR VISIBILITY
  ======================================================== */

  if (roles.has("HR")) {
    /*
     * Own project.
     */

    if (sameId(task.project_created_by, userId)) {
      return true;
    }

    /*
     * Project assigned directly to this HR by ADMIN.
     * HR can see its tasks even before handover.
     */

    if (sameId(task.assigned_hr_user_id, userId)) {
      return true;
    }

    /*
     * Project directly assigned to one of this HR's
     * reporting Team Leaders.
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
     * Tasks belonging to teams managed by this HR's
     * assigned Team Leaders.
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

  /* ========================================================
     TEAM LEADER VISIBILITY
  ======================================================== */

  if (roles.has("TEAM_LEADER")) {
    /*
     * A directly assigned independent project remains
     * visible even when team_id is NULL.
     */

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

    /*
     * Projects associated with the Team Leader's own team.
     */

    if (hasValidTeam) {
      const responsibleLeader = task.team_leader_id ?? task.team_created_by;

      if (sameId(responsibleLeader, userId)) {
        return true;
      }
    }
  }

  /* ========================================================
     REGULAR USER VISIBILITY
  ======================================================== */

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

/* ============================================================
   GENERAL TASK READ PERMISSIONS
============================================================ */

async function canReadTask(task, userId, db = pool) {
  if (!task) {
    return false;
  }

  const assignedToUser = sameId(task.assigned_to, userId);

  const isTeamMember = sameId(task.team_member_user_id, userId);

  const isProjectMember = sameId(task.actor_project_member_user_id, userId);

  const workspaceId = task.workspace_id;

  /* LEGACY PROJECT */

  if (!workspaceId) {
    return isTeamMember || sameId(task.created_by, userId) || assignedToUser;
  }

  const workspaceType = normalizeRole(task.workspace_type);

  if (!SUPPORTED_WORKSPACE_TYPES.includes(workspaceType)) {
    return false;
  }

  /* COMPANY WORKSPACE */

  if (workspaceType === "COMPANY") {
    return canReadCompanyTask(task, userId, db);
  }

  /* INDIVIDUAL / PROJECT WORKSPACE */

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

/* ============================================================
   REMOVE INTERNAL TASK ACCESS FIELDS
============================================================ */

function publicTask(task) {
  if (!task) {
    return task;
  }

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

/* ============================================================
   CREATE A TASK
============================================================ */

router.post("/", authMiddleware, async (req, res) => {
  const { title, description, projectId, assignedTo, priority, deadline } =
    req.body || {};

  if (
    typeof title !== "string" ||
    !title.trim() ||
    projectId === null ||
    projectId === undefined ||
    projectId === ""
  ) {
    return res.status(400).json({
      error: "Task title and project ID are required",
    });
  }

  const normalizedProjectId = Number(projectId);

  if (!Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return res.status(400).json({
      error: "Invalid project ID",
    });
  }

  const hasAssignee =
    assignedTo !== null && assignedTo !== undefined && assignedTo !== "";

  const normalizedAssignee = hasAssignee ? Number(assignedTo) : null;

  if (
    hasAssignee &&
    (!Number.isInteger(normalizedAssignee) || normalizedAssignee <= 0)
  ) {
    return res.status(400).json({
      error: "Invalid assignee ID",
    });
  }

  const client = await pool.connect();

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const project = await getProjectInformation(normalizedProjectId, client);

    if (!project) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        error: "Project not found",
      });
    }

    /* --------------------------------------------------------
       VERIFY TASK CREATION PERMISSION
    -------------------------------------------------------- */

    if (project.workspace_id) {
      const workspaceType = normalizeRole(project.workspace_type);

      if (workspaceType === "COMPANY") {
        const allowed = await canCreateCompanyTask(
          client,
          project,
          req.user.id,
        );

        if (!allowed) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(403).json({
            error:
              "You are not authorized to create tasks in this project. ADMIN can create tasks in all Company projects. HR can create tasks in their permitted projects, subject to project handover rules. Team Leaders can create tasks only in their own attached team projects.",
          });
        }
      } else {
        /*
         * INDIVIDUAL / PROJECT WORKSPACE
         *
         * Preserve the Workspace Team Leader permission rule.
         * Also support additional workspace roles.
         */

        const roles = await getWorkspaceRoles(
          client,
          project.workspace_id,
          req.user.id,
        );

        if (!roles.has("TEAM_LEADER")) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(403).json({
            error: "Only the Workspace Team Leader can create tasks",
          });
        }
      }
    } else {
      /* LEGACY TEAM */

      const memberResult = await client.query(
        `
          SELECT user_id

          FROM team_members

          WHERE team_id = $1
            AND user_id = $2

          LIMIT 1
        `,
        [project.team_id, req.user.id],
      );

      if (memberResult.rows.length === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          error: "Project not found or you are not a team member",
        });
      }
    }

    /* --------------------------------------------------------
       VALIDATE ASSIGNEE
    -------------------------------------------------------- */

    if (normalizedAssignee !== null) {
      let isEligibleAssignee = false;

      if (project.workspace_id) {
        isEligibleAssignee = await validateWorkspaceAssignee(client, {
          workspaceId: project.workspace_id,
          projectId: normalizedProjectId,
          teamId: project.team_id,
          userId: normalizedAssignee,
        });

        if (!isEligibleAssignee) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(400).json({
            error:
              "The assignee must be an active USER or TEAM_LEADER who belongs to this project or its assigned team.",
          });
        }
      } else {
        isEligibleAssignee = await validateLegacyAssignee(
          client,
          project.team_id,
          normalizedAssignee,
        );

        if (!isEligibleAssignee) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(400).json({
            error: "Assigned user is not an active member of the project team",
          });
        }
      }
    }

    /* --------------------------------------------------------
       INITIAL TASK STATE
    -------------------------------------------------------- */

    const initialStatus = "pending";
    const initialProgress = 0;

    /* --------------------------------------------------------
       INSERT TASK
    -------------------------------------------------------- */

    const result = await client.query(
      `
        INSERT INTO tasks
        (
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
        req.user.id,
        initialStatus,
        priority || "medium",
        deadline || null,
        initialProgress,
      ],
    );

    const task = result.rows[0];

    /* --------------------------------------------------------
       ASSIGNMENT NOTIFICATION
    -------------------------------------------------------- */

    if (
      normalizedAssignee !== null &&
      normalizedAssignee !== Number(req.user.id)
    ) {
      await client.query(
        `
          INSERT INTO notifications
          (
            user_id,
            title,
            message
          )

          VALUES ($1, $2, $3)
        `,
        [
          normalizedAssignee,
          "New Task Assigned",
          `You have been assigned a new task: ${task.title}`,
        ],
      );
    }

    await client.query("COMMIT");
    transactionStarted = false;

    await safelyLogTaskActivity(
      task.project_id,
      req.user.id,
      "TASK_CREATED",
      `Task "${task.title}" was created`,
    );

    return res.status(201).json(task);
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Task creation rollback error:", rollbackError.message);
      }
    }

    console.error("Task creation error:", error.message);

    if (error.code === "23503") {
      return res.status(404).json({
        error: "Project, workspace, team, or assigned user not found.",
      });
    }

    return res.status(500).json({
      error: "Database error",
    });
  } finally {
    client.release();
  }
});

/* ============================================================
   GET ALL ACCESSIBLE TASKS
============================================================ */

/*
 * Fetches candidate tasks from workspaces in which the
 * current user is a member.
 *
 * Then applies the same authorization rules used by the
 * single-task endpoint.
 *
 * COMPANY WORKSPACE:
 *
 * ADMIN:
 * All tasks.
 *
 * HR:
 * Own projects, assigned projects, and subordinate
 * Team Leader project/team tasks.
 *
 * TEAM_LEADER:
 * Directly assigned projects and own-team projects.
 *
 * USER:
 * Tasks assigned to the current user.
 *
 * INDIVIDUAL / PROJECT:
 * Existing role-based access is preserved.
 *
 * LEGACY:
 * Existing team-member access is preserved.
 */

router.get("/", authMiddleware, async (req, res) => {
  try {
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

          /*
           * Workspace tasks:
           * The user must belong to the project workspace.
           */

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

          /*
           * Legacy tasks:
           * Preserve team-member access.
           */

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

        ORDER BY
          tasks.created_at DESC NULLS LAST,
          tasks.id DESC
      `,
      [req.user.id],
    );

    /*
     * Enforce the detailed read-permission rules.
     *
     * This prevents a workspace member from seeing tasks
     * merely because they belong to the same workspace.
     */

    const accessibleTasks = [];

    for (const task of result.rows) {
      const allowed = await canReadTask(task, req.user.id, pool);

      if (allowed) {
        accessibleTasks.push(publicTask(task));
      }
    }

    return res.status(200).json(accessibleTasks);
  } catch (error) {
    console.error("Task fetch error:", error.message);

    return res.status(500).json({
      error: "Unable to retrieve accessible tasks.",
    });
  }
});

/* ============================================================
   GET A SINGLE TASK
============================================================ */

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const task = await getTaskAccessInformation(req.params.id, req.user.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const allowed = await canReadTask(task, req.user.id, pool);

    if (!allowed) {
      return res.status(403).json({
        error: "You are not authorized to view this task",
      });
    }

    return res.json(publicTask(task));
  } catch (error) {
    console.error("Single task fetch error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/* ============================================================
   UPDATE A TASK
============================================================ */

/*
 * EXISTING TASK EDITING RULES PRESERVED:
 *
 * 1. Assigned user can edit their own task.
 *
 * 2. Assigned user can move status forward:
 *    Pending -> In Progress -> In Review -> Completed.
 *
 * 3. Assigned user cannot move status backward.
 *
 * 4. A higher-role member can authorize a backward status
 *    change, but cannot modify the assigned user's other
 *    task details through this permission.
 *
 * 5. Task reassignment is not allowed after creation.
 */

router.put("/:id", authMiddleware, async (req, res) => {
  const body = req.body || {};

  const client = await pool.connect();

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const existingTask = await getTaskAccessInformation(
      req.params.id,
      req.user.id,
      client,
    );

    if (!existingTask) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        error: "Task not found",
      });
    }

    const actorId = Number(req.user.id);

    /* VERIFY TASK ACCESS */

    const hasTaskAccess = await canReadTask(existingTask, actorId, client);

    if (!hasTaskAccess) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error: "You are not authorized to update this task.",
      });
    }

    const isAssignee = sameId(existingTask.assigned_to, actorId);

    const isWorkspaceTask = Boolean(existingTask.workspace_id);

    /* PREVENT TASK REASSIGNMENT */

    const assignedToWasProvided =
      hasOwn(body, "assignedTo") || hasOwn(body, "assigned_to");

    const requestedAssignee = hasOwn(body, "assignedTo")
      ? body.assignedTo
      : body.assigned_to;

    if (assignedToWasProvided) {
      const normalizedRequestedAssignee =
        requestedAssignee === null ||
        requestedAssignee === undefined ||
        requestedAssignee === ""
          ? null
          : Number(requestedAssignee);

      const normalizedExistingAssignee =
        existingTask.assigned_to === null ||
        existingTask.assigned_to === undefined
          ? null
          : Number(existingTask.assigned_to);

      if (normalizedRequestedAssignee !== normalizedExistingAssignee) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          error: "The task assignee cannot be changed after task creation.",
        });
      }
    }

    /* RESOLVE REQUESTED FIELDS */

    const title = hasOwn(body, "title")
      ? String(body.title || "").trim()
      : existingTask.title;

    const description = hasOwn(body, "description")
      ? body.description || null
      : existingTask.description;

    const priority = hasOwn(body, "priority")
      ? body.priority || "medium"
      : existingTask.priority;

    const deadline = hasOwn(body, "deadline")
      ? body.deadline || null
      : existingTask.deadline;

    const requestedStatus = hasOwn(body, "status")
      ? normalizeTaskStatus(body.status)
      : normalizeTaskStatus(existingTask.status);

    const currentStatus = normalizeTaskStatus(existingTask.status);

    if (!title) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(400).json({
        error: "Task title is required",
      });
    }

    if (!requestedStatus) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(400).json({
        error:
          "Invalid task status. Use To Do, In Progress, In Review, or Complete.",
      });
    }

    if (!currentStatus) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(400).json({
        error: "The existing task has an invalid status and cannot be updated.",
      });
    }

    /* ========================================================
       LEGACY PROJECT PERMISSIONS
    ======================================================== */

    if (!isWorkspaceTask) {
      if (!sameId(existingTask.created_by, actorId)) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          error: "Only the task creator can update this legacy task.",
        });
      }

      const result = await client.query(
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
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          error: "Task not found",
        });
      }

      await client.query("COMMIT");
      transactionStarted = false;

      await safelyLogTaskActivity(
        existingTask.project_id,
        actorId,
        "TASK_UPDATED",
        `Task "${title}" was updated`,
      );

      return res.json(result.rows[0]);
    }

    /* ========================================================
       ASSIGNEE CAN EDIT THEIR OWN TASK
    ======================================================== */

    if (isAssignee) {
      if (isBackwardStatusChange(currentStatus, requestedStatus)) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          error:
            "You cannot move your task backward. Ask a higher-role workspace member for authorization.",
        });
      }

      if (
        requestedStatus !== currentStatus &&
        !isForwardStatusChange(currentStatus, requestedStatus)
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          error: "Invalid task status transition.",
        });
      }

      const result = await client.query(
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
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          error: "Task not found",
        });
      }

      await client.query("COMMIT");
      transactionStarted = false;

      await safelyLogTaskActivity(
        existingTask.project_id,
        actorId,
        "TASK_UPDATED",
        `Task "${title}" was updated`,
      );

      return res.json(result.rows[0]);
    }

    /* ========================================================
       HIGHER-ROLE STATUS ROLLBACK
    ======================================================== */

    const actorRoles = await getWorkspaceRoles(
      client,
      existingTask.workspace_id,
      actorId,
    );

    const assignedUserRoles =
      existingTask.assigned_to !== null &&
      existingTask.assigned_to !== undefined
        ? await getWorkspaceRoles(
            client,
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
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          error:
            "A higher-role member may change task status backward, but cannot edit the assigned user's other task details.",
        });
      }

      const result = await client.query(
        `
          UPDATE tasks

          SET
            status = $1,
            progress = $2

          WHERE id = $3

          RETURNING *
        `,
        [
          requestedStatus,
          getProgressForStatus(requestedStatus),
          existingTask.id,
        ],
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          error: "Task not found",
        });
      }

      await client.query("COMMIT");
      transactionStarted = false;

      await safelyLogTaskActivity(
        existingTask.project_id,
        actorId,
        "TASK_STATUS_ROLLED_BACK",
        `Task "${existingTask.title}" status was moved backward to ${requestedStatus}`,
      );

      return res.json(result.rows[0]);
    }

    /* DENY UNAUTHORIZED UPDATES */

    await client.query("ROLLBACK");
    transactionStarted = false;

    return res.status(403).json({
      error:
        "Only the assigned user can edit this task. A higher-role member may authorize a backward status change when permitted.",
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Task update rollback error:", rollbackError.message);
      }
    }

    console.error("Task update error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  } finally {
    client.release();
  }
});

/* ============================================================
   DELETE A TASK
============================================================ */

/*
 * Existing deletion rule preserved:
 *
 * Workspace task:
 * Only a Team Leader with task visibility can delete it.
 *
 * Legacy task:
 * Only the original task creator can delete it.
 */

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const task = await getTaskAccessInformation(req.params.id, req.user.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const actorId = Number(req.user.id);

    /* VERIFY TASK ACCESS */

    const hasTaskAccess = await canReadTask(task, actorId, pool);

    if (!hasTaskAccess) {
      return res.status(403).json({
        error: "You are not authorized to delete this task.",
      });
    }

    /* WORKSPACE TASK DELETION */

    if (task.workspace_id) {
      const actorRoles = await getWorkspaceRoles(
        pool,
        task.workspace_id,
        actorId,
      );

      if (!actorRoles.has("TEAM_LEADER")) {
        return res.status(403).json({
          error: "Only the Workspace Team Leader can delete this task",
        });
      }
    } else {
      /* LEGACY TASK */

      if (!sameId(task.created_by, actorId)) {
        return res.status(403).json({
          error: "Only the task creator can delete this legacy task",
        });
      }
    }

    /* DELETE */

    const result = await pool.query(
      `
        DELETE FROM tasks

        WHERE id = $1

        RETURNING *
      `,
      [task.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    await safelyLogTaskActivity(
      task.project_id,
      actorId,
      "TASK_DELETED",
      `Task "${task.title}" was deleted`,
    );

    return res.json({
      message: "Task deleted successfully",
      task: result.rows[0],
    });
  } catch (error) {
    console.error("Task deletion error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/* ============================================================
   EXPORT ROUTER
============================================================ */

module.exports = router;
