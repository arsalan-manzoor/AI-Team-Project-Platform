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

async function getWorkspaceMemberRoles(workspaceId, userId, db = pool) {
  const result = await db.query(
    `
      SELECT DISTINCT normalized_role
      FROM (
        SELECT
          UPPER(TRIM(wmr.role::TEXT)) AS normalized_role
        FROM workspace_members wm
        JOIN workspace_member_roles wmr
          ON wmr.workspace_member_id = wm.id
        WHERE wm.workspace_id = $1
          AND wm.user_id = $2

        UNION ALL

        SELECT
          UPPER(TRIM(wm.role::TEXT)) AS normalized_role
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
 * Supports:
 * - Independent Company projects.
 * - Team-attached Company projects.
 * - Individual workspaces.
 * - PROJECT workspaces.
 * - Legacy team-based projects.
 *
 * projects.workspace_id is preferred.
 * teams.workspace_id is used as a fallback.
 */

async function getTaskAccessInformation(taskId, userId, db = pool) {
  const result = await db.query(
    `
      SELECT
        t.id,
        t.assigned_to,
        t.created_by,

        p.id AS project_id,
        p.team_id,

        COALESCE(
          p.workspace_id,
          tm.workspace_id
        ) AS workspace_id,

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

      LEFT JOIN teams tm
        ON p.team_id = tm.id

      LEFT JOIN workspaces w
        ON w.id = COALESCE(
          p.workspace_id,
          tm.workspace_id
        )

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
 * Authorization always uses the actual parent task.
 *
 * Independent Company projects are supported because
 * the teams relationship is a LEFT JOIN.
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

        p.id AS project_id,
        p.team_id,

        COALESCE(
          p.workspace_id,
          tm.workspace_id
        ) AS workspace_id,

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

      LEFT JOIN teams tm
        ON p.team_id = tm.id

      LEFT JOIN workspaces w
        ON w.id = COALESCE(
          p.workspace_id,
          tm.workspace_id
        )

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

async function canReadParentTask(task, userId, db = pool) {
  if (!task) {
    return false;
  }

  // Legacy project without a workspace.
  if (!task.workspace_id) {
    return sameId(task.assigned_to, userId) || sameId(task.created_by, userId);
  }

  const workspaceType = normalizeRole(task.workspace_type);

  if (!SUPPORTED_WORKSPACE_TYPES.includes(workspaceType)) {
    return false;
  }

  const roles = await getWorkspaceMemberRoles(task.workspace_id, userId, db);

  if (roles.size === 0) {
    return false;
  }

  // Workspace management roles retain workspace-wide read access.
  if (hasAnyRole(roles, MANAGEMENT_ROLES)) {
    return true;
  }

  // Regular users can read their own assigned tasks.
  if (hasRole(roles, "USER") && sameId(task.assigned_to, userId)) {
    return true;
  }

  return false;
}

/* ============================================================
   SUBTASK CREATION / MODIFICATION PERMISSIONS
============================================================ */

/*
 * WORKSPACE PROJECTS:
 *
 * PROJECT / INDIVIDUAL:
 * TEAM_LEADER in the relevant workspace.
 *
 * COMPANY:
 * TEAM_LEADER must either:
 * - Lead the project team, or
 * - Have direct TEAM_LEADER project membership.
 *
 * LEGACY PROJECTS:
 * Requester must belong to the parent task's project team
 * and have access to the parent task.
 */

async function canManageSubtask(task, userId, db = pool) {
  if (!task) {
    return false;
  }

  const parentTaskAccessible = await canReadParentTask(task, userId, db);

  if (!parentTaskAccessible) {
    return false;
  }

  if (task.workspace_id) {
    const workspaceType = normalizeRole(task.workspace_type);

    if (!SUPPORTED_WORKSPACE_TYPES.includes(workspaceType)) {
      return false;
    }

    const roles = await getWorkspaceMemberRoles(task.workspace_id, userId, db);

    if (!hasRole(roles, "TEAM_LEADER")) {
      return false;
    }

    /*
     * COMPANY WORKSPACE:
     * Verify that this Team Leader actually has authority
     * over the specific project.
     */
    if (workspaceType === "COMPANY") {
      const assignmentResult = await db.query(
        `
          SELECT 1

          FROM projects p

          LEFT JOIN teams tm
            ON tm.id = p.team_id

          WHERE p.id = $1

            AND (
              (
                tm.id IS NOT NULL
                AND tm.workspace_id = $2
                AND COALESCE(
                  tm.team_leader_id,
                  tm.created_by
                ) = $3
              )

              OR EXISTS (
                SELECT 1

                FROM project_members pm

                WHERE pm.project_id = p.id
                  AND pm.user_id = $3

                  AND UPPER(
                    TRIM(pm.role::TEXT)
                  ) = 'TEAM_LEADER'
              )
            )

          LIMIT 1
        `,
        [task.project_id, task.workspace_id, userId],
      );

      return assignmentResult.rows.length > 0;
    }

    // Preserve existing PROJECT and INDIVIDUAL workspace behavior.
    return true;
  }

  // Preserve legacy team-based authorization.
  return task.is_team_member === true;
}

/* ============================================================
   SUBTASK CREATOR DATA
============================================================ */

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
    const task = await getTaskAccessInformation(normalizedTaskId, req.user.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

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

router.get("/task/:taskId", authMiddleware, async (req, res) => {
  const taskId = Number(req.params.taskId);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({
      error: "A valid task ID is required",
    });
  }

  try {
    const task = await getTaskAccessInformation(taskId, req.user.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const authorized = await canReadParentTask(task, req.user.id);

    if (!authorized) {
      return res.status(403).json({
        error: "You are not authorized to view this task's subtasks",
      });
    }

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
    const subtask = await getSubtaskAccessInformation(subtaskId, req.user.id);

    if (!subtask) {
      return res.status(404).json({
        error: "Subtask not found",
      });
    }

    const authorized = await canManageSubtask(subtask, req.user.id);

    if (!authorized) {
      return res.status(403).json({
        error: "You are not authorized to update this subtask",
      });
    }

    const nextStatus =
      typeof status === "string" && status.trim() ? status.trim() : "pending";

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

router.delete("/:id", authMiddleware, async (req, res) => {
  const subtaskId = Number(req.params.id);

  if (!Number.isInteger(subtaskId) || subtaskId <= 0) {
    return res.status(400).json({
      error: "A valid subtask ID is required",
    });
  }

  try {
    const subtask = await getSubtaskAccessInformation(subtaskId, req.user.id);

    if (!subtask) {
      return res.status(404).json({
        error: "Subtask not found",
      });
    }

    const authorized = await canManageSubtask(subtask, req.user.id);

    if (!authorized) {
      return res.status(403).json({
        error: "You are not authorized to delete this subtask",
      });
    }

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
