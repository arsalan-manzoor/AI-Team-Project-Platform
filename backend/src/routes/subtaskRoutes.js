const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const SUPPORTED_WORKSPACE_TYPES = ["PROJECT", "COMPANY", "INDIVIDUAL"];

const MANAGEMENT_ROLES = ["TEAM_LEADER", "HR", "ADMIN"];

/* ============================================================
   COMMON HELPERS
============================================================ */

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
    second === undefined
  ) {
    return false;
  }

  return Number(first) === Number(second);
}

function hasRole(roles, expectedRole) {
  return roles.has(normalizeRole(expectedRole));
}

function hasAnyRole(roles, expectedRoles) {
  return expectedRoles.some((role) => hasRole(roles, role));
}

/* ============================================================
   WORKSPACE ROLE HELPERS
============================================================ */

/*
 * Supports multiple role assignments in one workspace.
 *
 * Also supports the legacy workspace_members.role field.
 *
 * All roles returned by this function belong to the specified
 * user AND the specified workspace.
 */
async function getWorkspaceMemberRoles(workspaceId, userId, db = pool) {
  const result = await db.query(
    `
      SELECT DISTINCT normalized_role

      FROM (
        SELECT
          UPPER(
            TRIM(wmr.role::TEXT)
          ) AS normalized_role

        FROM workspace_members wm

        JOIN workspace_member_roles wmr
          ON wmr.workspace_member_id = wm.id

        WHERE wm.workspace_id = $1
          AND wm.user_id = $2

        UNION ALL

        SELECT
          UPPER(
            TRIM(wm.role::TEXT)
          ) AS normalized_role

        FROM workspace_members wm

        WHERE wm.workspace_id = $1
          AND wm.user_id = $2
          AND wm.role IS NOT NULL
      ) role_rows

      WHERE normalized_role IS NOT NULL
        AND normalized_role <> ''
    `,
    [workspaceId, userId],
  );

  return new Set(
    result.rows
      .map((row) => normalizeRole(row.normalized_role))
      .filter(Boolean),
  );
}

/* ============================================================
   TASK ACCESS INFORMATION
============================================================ */

/*
 * Retrieves the parent task and the relevant project context.
 *
 * Every subtask permission check uses its parent task.
 *
 * IMPORTANT:
 *
 * A subtask ID is never treated as a task ID.
 * Parent task access is checked using the actual task_id.
 */
async function getTaskAccessInformation(taskId, userId, db = pool) {
  const result = await db.query(
    `
      SELECT
        t.id,
        t.assigned_to,
        t.created_by,

        p.team_id,

        tm.workspace_id,

        w.type AS workspace_type,

        EXISTS (
          SELECT 1

          FROM team_members team_member

          WHERE team_member.team_id = p.team_id
            AND team_member.user_id = $2
        ) AS is_team_member

      FROM tasks t

      JOIN projects p
        ON t.project_id = p.id

      JOIN teams tm
        ON p.team_id = tm.id

      LEFT JOIN workspaces w
        ON tm.workspace_id = w.id

      WHERE t.id = $1

      LIMIT 1
    `,
    [taskId, userId],
  );

  return result.rows[0] || null;
}

/* ============================================================
   SUBTASK ACCESS INFORMATION
============================================================ */

/*
 * Retrieves the subtask AND its actual parent task.
 *
 * Authorization is based on:
 *
 * subtasks.id
 *     -> subtasks.task_id
 *         -> tasks.id
 *             -> projects.id
 *                 -> teams.id
 *                     -> teams.workspace_id
 *
 * This prevents authorization from being checked against an
 * unrelated task or workspace.
 */
async function getSubtaskAccessInformation(subtaskId, userId, db = pool) {
  const result = await db.query(
    `
      SELECT
        s.id AS subtask_id,
        s.task_id,

        t.id AS parent_task_id,
        t.assigned_to,
        t.created_by,

        p.team_id,

        tm.workspace_id,

        w.type AS workspace_type,

        EXISTS (
          SELECT 1

          FROM team_members team_member

          WHERE team_member.team_id = p.team_id
            AND team_member.user_id = $2
        ) AS is_team_member

      FROM subtasks s

      JOIN tasks t
        ON s.task_id = t.id

      JOIN projects p
        ON t.project_id = p.id

      JOIN teams tm
        ON p.team_id = tm.id

      LEFT JOIN workspaces w
        ON tm.workspace_id = w.id

      WHERE s.id = $1

      LIMIT 1
    `,
    [subtaskId, userId],
  );

  return result.rows[0] || null;
}

/* ============================================================
   PARENT TASK READ PERMISSIONS
============================================================ */

/*
 * A user must be authorized to read the parent task before
 * they can retrieve its subtasks.
 *
 * WORKSPACE PROJECTS:
 *
 * TEAM_LEADER, HR, and ADMIN:
 *     May read workspace tasks.
 *
 * USER:
 *     May read tasks assigned to them when they have the USER
 *     role in that workspace.
 *
 * LEGACY PROJECTS:
 *
 *     The task assignee and task creator retain access.
 *
 *     Project-team membership alone is insufficient.
 */
async function canReadParentTask(task, userId, db = pool) {
  if (!task) {
    return false;
  }

  /*
   * Legacy project without a workspace.
   */
  if (!task.workspace_id) {
    return sameId(task.assigned_to, userId) || sameId(task.created_by, userId);
  }

  /*
   * Validate the workspace type.
   */
  const workspaceType = normalizeRole(task.workspace_type);

  if (!SUPPORTED_WORKSPACE_TYPES.includes(workspaceType)) {
    return false;
  }

  /*
   * Retrieve roles from the actual workspace membership.
   */
  const roles = await getWorkspaceMemberRoles(task.workspace_id, userId, db);

  /*
   * No valid workspace roles means no workspace task access.
   */
  if (roles.size === 0) {
    return false;
  }

  /*
   * Authorized management roles retain workspace-wide access.
   */
  if (hasAnyRole(roles, MANAGEMENT_ROLES)) {
    return true;
  }

  /*
   * A regular USER can access their assigned tasks.
   */
  if (hasRole(roles, "USER") && sameId(task.assigned_to, userId)) {
    return true;
  }

  return false;
}

/* ============================================================
   SUBTASK CREATION / MODIFICATION PERMISSIONS
============================================================ */

/*
 * Existing permission rules are preserved where possible.
 *
 * WORKSPACE PROJECTS:
 *
 * Only a TEAM_LEADER in the relevant workspace may create,
 * update, or delete subtasks.
 *
 * LEGACY PROJECTS:
 *
 * The requester must be a project-team member AND have
 * access to the parent task.
 *
 * A regular team member cannot modify subtasks belonging
 * to an unrelated member's task.
 */
async function canManageSubtask(task, userId, db = pool) {
  if (!task) {
    return false;
  }

  /*
   * The parent task must be accessible first.
   */
  const parentTaskAccessible = await canReadParentTask(task, userId, db);

  if (!parentTaskAccessible) {
    return false;
  }

  /*
   * Workspace-linked task.
   */
  if (task.workspace_id) {
    const workspaceType = normalizeRole(task.workspace_type);

    if (!SUPPORTED_WORKSPACE_TYPES.includes(workspaceType)) {
      return false;
    }

    const roles = await getWorkspaceMemberRoles(task.workspace_id, userId, db);

    return hasRole(roles, "TEAM_LEADER");
  }

  /*
   * Legacy project.
   *
   * Retain the existing requirement that the requester
   * belongs to the parent task's project team.
   */
  return task.is_team_member === true;
}

/* ============================================================
   SUBTASK CREATOR DATA
============================================================ */

/*
 * Preserve the existing response fields used by the frontend.
 *
 * Existing subtasks without created_by remain NULL.
 * Their original creator cannot safely be inferred.
 */
const SUBTASK_CREATOR_COLUMNS = `
  s.id,
  s.title,
  s.task_id,
  s.status,
  s.created_at,
  s.created_by,

  COALESCE(
    NULLIF(TRIM(u.name), ''),
    u.email
  ) AS creator_name,

  COALESCE(
    NULLIF(TRIM(u.name), ''),
    u.email
  ) AS created_by_name,

  u.email AS creator_email,
  u.email AS created_by_email,

  COALESCE(
    NULLIF(TRIM(u.name), ''),
    u.email
  ) AS "creatorName",

  COALESCE(
    NULLIF(TRIM(u.name), ''),
    u.email
  ) AS "createdByName",

  u.email AS "creatorEmail",
  u.email AS "createdByEmail",

  CASE
    WHEN u.id IS NULL THEN NULL

    ELSE jsonb_build_object(
      'id', u.id,

      'name', COALESCE(
        NULLIF(TRIM(u.name), ''),
        u.email
      ),

      'email', u.email
    )
  END AS creator
`;

const SUBTASK_CREATOR_JOINS = `
  FROM subtasks s

  LEFT JOIN users u
    ON u.id = s.created_by
`;

/*
 * This helper is used only after the relevant create/update
 * request has passed its authorization checks.
 */
async function getSubtaskWithCreator(subtaskId, db = pool) {
  const result = await db.query(
    `
      SELECT
        ${SUBTASK_CREATOR_COLUMNS}

      ${SUBTASK_CREATOR_JOINS}

      WHERE s.id = $1

      LIMIT 1
    `,
    [subtaskId],
  );

  return result.rows[0] || null;
}

/* ============================================================
   CREATE A SUBTASK
============================================================ */

/*
 * POST /api/subtasks
 *
 * Body:
 *
 * {
 *   "title": "Build login page",
 *   "taskId": 7,
 *   "status": "pending"
 * }
 *
 * Workspace project:
 * Only a TEAM_LEADER in the correct workspace may create
 * the subtask.
 *
 * Legacy project:
 * The requester must belong to the project team and have
 * access to the parent task.
 *
 * created_by records the logged-in user.
 */

router.post("/", authMiddleware, async (req, res) => {
  const { title, taskId, status } = req.body || {};

  const normalizedTitle = typeof title === "string" ? title.trim() : "";

  const normalizedTaskId = Number(taskId);

  if (
    !normalizedTitle ||
    !Number.isInteger(normalizedTaskId) ||
    normalizedTaskId <= 0
  ) {
    return res.status(400).json({
      error: "A valid subtask title and task ID are required",
    });
  }

  try {
    /*
     * Fetch the actual parent task.
     */
    const task = await getTaskAccessInformation(normalizedTaskId, req.user.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    /*
     * Check permission against that parent task.
     */
    const authorized = await canManageSubtask(task, req.user.id);

    if (!authorized) {
      return res.status(403).json({
        error: task.workspace_id
          ? "Only an authorized Workspace Team Leader can create subtasks"
          : "You must have access to the parent task and belong to its project team to create subtasks",
      });
    }

    const initialStatus =
      typeof status === "string" && status.trim() ? status.trim() : "pending";

    /*
     * The task_id comes from the validated parent task ID.
     * The creator comes from the authenticated user.
     */
    const insertResult = await pool.query(
      `
        INSERT INTO subtasks (
          title,
          task_id,
          status,
          created_by
        )

        VALUES ($1, $2, $3, $4)

        RETURNING id
      `,
      [normalizedTitle, task.id, initialStatus, req.user.id],
    );

    const createdSubtask = await getSubtaskWithCreator(insertResult.rows[0].id);

    if (!createdSubtask) {
      return res.status(201).json({
        id: insertResult.rows[0].id,
        title: normalizedTitle,
        task_id: task.id,
        status: initialStatus,
        created_by: req.user.id,
      });
    }

    return res.status(201).json(createdSubtask);
  } catch (error) {
    console.error("Subtask creation error:", error.message);

    return res.status(500).json({
      error: "Unable to create subtask",
    });
  }
});

/* ============================================================
   GET SUBTASKS FOR A TASK
============================================================ */

/*
 * GET /api/subtasks/task/:taskId
 *
 * Before fetching subtasks:
 *
 * 1. Validate the parent task ID.
 * 2. Retrieve the parent task.
 * 3. Check whether the requester can access that task.
 * 4. Retrieve subtasks using that exact task ID.
 *
 * This applies consistently to PROJECT, COMPANY, INDIVIDUAL,
 * and legacy projects.
 *
 * Creator information and the existing response structure
 * are preserved.
 */

router.get("/task/:taskId", authMiddleware, async (req, res) => {
  const taskId = Number(req.params.taskId);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({
      error: "A valid task ID is required",
    });
  }

  try {
    /*
     * Retrieve the parent task first.
     */
    const task = await getTaskAccessInformation(taskId, req.user.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    /*
     * Parent-task authorization is mandatory.
     */
    const authorized = await canReadParentTask(task, req.user.id);

    if (!authorized) {
      return res.status(403).json({
        error: "You are not authorized to view this task's subtasks",
      });
    }

    /*
     * Fetch subtasks belonging ONLY to the authorized task.
     *
     * No global subtask list is exposed.
     */
    const result = await pool.query(
      `
          SELECT
            ${SUBTASK_CREATOR_COLUMNS}

          ${SUBTASK_CREATOR_JOINS}

          WHERE s.task_id = $1

          ORDER BY s.id
        `,
      [task.id],
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Subtask fetch error:", error.message);

    return res.status(500).json({
      error: "Unable to retrieve subtasks",
    });
  }
});

/* ============================================================
   UPDATE A SUBTASK
============================================================ */

/*
 * PUT /api/subtasks/:id
 *
 * Existing body structure is preserved:
 *
 * {
 *   "title": "Updated title",
 *   "status": "in_progress"
 * }
 *
 * Workspace project:
 * Only a TEAM_LEADER in the correct workspace may update
 * the subtask.
 *
 * Legacy project:
 * The requester must belong to the parent task's project
 * team and have access to that parent task.
 *
 * The subtask's task_id and created_by are not changed.
 */

router.put("/:id", authMiddleware, async (req, res) => {
  const subtaskId = Number(req.params.id);

  const { title, status } = req.body || {};

  const normalizedTitle = typeof title === "string" ? title.trim() : "";

  if (!Number.isInteger(subtaskId) || subtaskId <= 0 || !normalizedTitle) {
    return res.status(400).json({
      error: "A valid subtask ID and title are required",
    });
  }

  try {
    /*
     * Fetch the subtask and its actual parent task.
     */
    const subtask = await getSubtaskAccessInformation(subtaskId, req.user.id);

    if (!subtask) {
      return res.status(404).json({
        error: "Subtask not found",
      });
    }

    /*
     * Authorize using the parent task associated with this
     * exact subtask ID.
     */
    const authorized = await canManageSubtask(subtask, req.user.id);

    if (!authorized) {
      return res.status(403).json({
        error: "You are not authorized to update this subtask",
      });
    }

    /*
     * Preserve the existing status behavior.
     */
    const nextStatus =
      typeof status === "string" && status.trim() ? status.trim() : "pending";

    /*
     * Only update the requested subtask.
     *
     * task_id and created_by remain unchanged.
     */
    const updateResult = await pool.query(
      `
        UPDATE subtasks

        SET
          title = $1,
          status = $2

        WHERE id = $3
          AND task_id = $4

        RETURNING id
      `,
      [normalizedTitle, nextStatus, subtask.subtask_id, subtask.task_id],
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        error: "Subtask not found",
      });
    }

    const updatedSubtask = await getSubtaskWithCreator(subtask.subtask_id);

    if (!updatedSubtask) {
      return res.status(404).json({
        error: "Subtask not found after update",
      });
    }

    return res.json(updatedSubtask);
  } catch (error) {
    console.error("Subtask update error:", error.message);

    return res.status(500).json({
      error: "Unable to update subtask",
    });
  }
});

/* ============================================================
   DELETE A SUBTASK
============================================================ */

/*
 * DELETE /api/subtasks/:id
 *
 * Workspace project:
 * Only a TEAM_LEADER in the correct workspace may delete
 * the subtask.
 *
 * Legacy project:
 * The requester must belong to the parent task's project
 * team and have access to that parent task.
 *
 * The deletion is scoped to the validated subtask ID and
 * its parent task ID.
 */

router.delete("/:id", authMiddleware, async (req, res) => {
  const subtaskId = Number(req.params.id);

  if (!Number.isInteger(subtaskId) || subtaskId <= 0) {
    return res.status(400).json({
      error: "A valid subtask ID is required",
    });
  }

  try {
    /*
     * Fetch the subtask and its actual parent task.
     */
    const subtask = await getSubtaskAccessInformation(subtaskId, req.user.id);

    if (!subtask) {
      return res.status(404).json({
        error: "Subtask not found",
      });
    }

    /*
     * Enforce the existing permission hierarchy and validate
     * access to the correct parent task.
     */
    const authorized = await canManageSubtask(subtask, req.user.id);

    if (!authorized) {
      return res.status(403).json({
        error: "You are not authorized to delete this subtask",
      });
    }

    /*
     * Delete only this subtask from its validated parent task.
     */
    const deleteResult = await pool.query(
      `
        DELETE FROM subtasks

        WHERE id = $1
          AND task_id = $2

        RETURNING *
      `,
      [subtask.subtask_id, subtask.task_id],
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        error: "Subtask not found",
      });
    }

    return res.json({
      message: "Subtask deleted successfully",
      subtask: deleteResult.rows[0],
    });
  } catch (error) {
    console.error("Subtask deletion error:", error.message);

    return res.status(500).json({
      error: "Unable to delete subtask",
    });
  }
});

module.exports = router;
