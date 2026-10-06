const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const { logProjectActivity } = require("../utils/projectActivity");

const router = express.Router();

/*
 * Create a task
 */
router.post("/", authMiddleware, async (req, res) => {
  const {
    title,
    description,
    projectId,
    assignedTo,
    status,
    priority,
    deadline,
  } = req.body;

  if (!title || !projectId) {
    return res.status(400).json({
      error: "Task title and project ID are required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Get the project and its team/workspace.
     */
    const projectResult = await client.query(
      `SELECT projects.id,
              projects.team_id,
              teams.workspace_id
       FROM projects
       JOIN teams
         ON projects.team_id = teams.id
       WHERE projects.id = $1`,
      [projectId],
    );

    if (projectResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Project not found",
      });
    }

    const project = projectResult.rows[0];

    /*
     * Workspace-linked project:
     * Only the TEAM_LEADER can create tasks.
     */
    if (project.workspace_id) {
      const leaderResult = await client.query(
        `SELECT workspace_members.id
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspace_members.role = 'TEAM_LEADER'
           AND workspaces.type IN ('PROJECT', 'COMPANY')`,
        [project.workspace_id, req.user.id],
      );

      if (leaderResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "Only the Workspace Team Leader can create tasks",
        });
      }
    } else {
      /*
       * Preserve legacy project behavior.
       * User must be a member of the project team.
       */
      const memberResult = await client.query(
        `SELECT team_members.user_id
         FROM team_members
         WHERE team_members.team_id = $1
           AND team_members.user_id = $2`,
        [project.team_id, req.user.id],
      );

      if (memberResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Project not found or you are not a team member",
        });
      }
    }

    /*
     * Validate assignee.
     */
    if (assignedTo) {
      if (project.workspace_id) {
        /*
         * Workspace project:
         * Assignee must be a USER in the same workspace
         * and a member of the project team.
         */
        const assigneeResult = await client.query(
          `SELECT workspace_members.user_id
           FROM workspace_members
           JOIN team_members
             ON workspace_members.user_id = team_members.user_id
           WHERE workspace_members.workspace_id = $1
             AND workspace_members.user_id = $2
             AND workspace_members.role = 'USER'
             AND team_members.team_id = $3`,
          [project.workspace_id, assignedTo, project.team_id],
        );

        if (assigneeResult.rows.length === 0) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            error:
              "Assigned user must be a USER in the workspace and a member of the project team",
          });
        }
      } else {
        /*
         * Preserve legacy assignee behavior.
         */
        const memberResult = await client.query(
          `SELECT team_members.user_id
           FROM team_members
           WHERE team_members.team_id = $1
             AND team_members.user_id = $2`,
          [project.team_id, assignedTo],
        );

        if (memberResult.rows.length === 0) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            error: "Assigned user is not a member of the project team",
          });
        }
      }
    }

    const result = await client.query(
      `INSERT INTO tasks
       (title, description, project_id, assigned_to, created_by, status, priority, deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        title,
        description || null,
        projectId,
        assignedTo || null,
        req.user.id,
        status || "pending",
        priority || "medium",
        deadline || null,
      ],
    );

    const task = result.rows[0];

    /*
     * Create notification when a task is assigned
     * to another user.
     */
    if (assignedTo && Number(assignedTo) !== Number(req.user.id)) {
      await client.query(
        `INSERT INTO notifications
         (user_id, title, message)
         VALUES ($1, $2, $3)`,
        [
          assignedTo,
          "New Task Assigned",
          `You have been assigned a new task: ${title}`,
        ],
      );
    }

    await client.query("COMMIT");

    /*
     * Create project activity after the main task transaction
     * has successfully committed.
     *
     * Activity logging must never break successful task creation.
     */
    await logProjectActivity(
      task.project_id,
      req.user.id,
      "TASK_CREATED",
      `Task "${task.title}" was created`,
    );

    res.status(201).json(task);
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Task creation error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  } finally {
    client.release();
  }
});

/*
 * Get all tasks accessible to the logged-in user.
 *
 * TEAM_LEADER and USER members of a workspace project
 * can view its tasks.
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tasks.id,
              tasks.title,
              tasks.description,
              tasks.project_id,
              tasks.assigned_to,
              tasks.created_by,
              tasks.status,
              tasks.priority,
              tasks.deadline,
              tasks.created_at
       FROM tasks
       JOIN projects
         ON tasks.project_id = projects.id
       JOIN teams
         ON projects.team_id = teams.id
       JOIN team_members
         ON projects.team_id = team_members.team_id
       WHERE team_members.user_id = $1`,
      [req.user.id],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Task fetch error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

/*
 * Get a single task.
 */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tasks.id,
              tasks.title,
              tasks.description,
              tasks.project_id,
              tasks.assigned_to,
              tasks.created_by,
              tasks.status,
              tasks.priority,
              tasks.deadline,
              tasks.created_at
       FROM tasks
       JOIN projects
         ON tasks.project_id = projects.id
       JOIN teams
         ON projects.team_id = teams.id
       JOIN team_members
         ON projects.team_id = team_members.team_id
       WHERE tasks.id = $1
         AND team_members.user_id = $2`,
      [req.params.id, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Task fetch error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

/*
 * Update a task.
 */
router.put("/:id", authMiddleware, async (req, res) => {
  const { title, description, assignedTo, status, priority, deadline } =
    req.body;

  if (!title) {
    return res.status(400).json({
      error: "Task title is required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Get the existing task, project, team and workspace.
     */
    const existingTaskResult = await client.query(
      `SELECT tasks.id,
              tasks.project_id,
              tasks.assigned_to,
              tasks.created_by,
              projects.team_id,
              teams.workspace_id
       FROM tasks
       JOIN projects
         ON tasks.project_id = projects.id
       JOIN teams
         ON projects.team_id = teams.id
       WHERE tasks.id = $1`,
      [req.params.id],
    );

    if (existingTaskResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Task not found",
      });
    }

    const existingTask = existingTaskResult.rows[0];

    /*
     * Workspace-linked project:
     * Only TEAM_LEADER can update the task.
     */
    if (existingTask.workspace_id) {
      const leaderResult = await client.query(
        `SELECT workspace_members.id
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspace_members.role = 'TEAM_LEADER'
           AND workspaces.type IN ('PROJECT', 'COMPANY')`,
        [existingTask.workspace_id, req.user.id],
      );

      if (leaderResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error: "Only the Workspace Team Leader can update this task",
        });
      }
    } else {
      /*
       * Preserve legacy behavior:
       * only the task creator can update it.
       */
      if (existingTask.created_by !== req.user.id) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Task not found or you are not the creator",
        });
      }
    }

    /*
     * Keep track of the previous assignee
     * so reassignment notifications continue working.
     */
    const oldAssignee =
      existingTask.assigned_to === null ||
      existingTask.assigned_to === undefined
        ? null
        : Number(existingTask.assigned_to);

    const newAssignee =
      assignedTo === null || assignedTo === undefined || assignedTo === ""
        ? null
        : Number(assignedTo);

    /*
     * Validate new assignee.
     */
    if (newAssignee !== null) {
      if (existingTask.workspace_id) {
        /*
         * Workspace project:
         * New assignee must be a USER in the workspace
         * and a member of the project team.
         */
        const memberResult = await client.query(
          `SELECT workspace_members.user_id
           FROM workspace_members
           JOIN team_members
             ON workspace_members.user_id = team_members.user_id
           WHERE workspace_members.workspace_id = $1
             AND workspace_members.user_id = $2
             AND workspace_members.role = 'USER'
             AND team_members.team_id = $3`,
          [existingTask.workspace_id, newAssignee, existingTask.team_id],
        );

        if (memberResult.rows.length === 0) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            error:
              "Assigned user must be a USER in the workspace and a member of the project team",
          });
        }
      } else {
        /*
         * Preserve legacy assignee behavior.
         */
        const memberResult = await client.query(
          `SELECT team_members.user_id
           FROM team_members
           WHERE team_members.team_id = $1
             AND team_members.user_id = $2`,
          [existingTask.team_id, newAssignee],
        );

        if (memberResult.rows.length === 0) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            error: "Assigned user is not a member of the project team",
          });
        }
      }
    }

    const result = await client.query(
      `UPDATE tasks
       SET title = $1,
           description = $2,
           assigned_to = $3,
           status = $4,
           priority = $5,
           deadline = $6
       WHERE id = $7
       RETURNING *`,
      [
        title,
        description || null,
        newAssignee,
        status || "pending",
        priority || "medium",
        deadline || null,
        req.params.id,
      ],
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Task not found",
      });
    }

    const updatedTask = result.rows[0];

    /*
     * Create notification when the task is reassigned
     * to a different user.
     */
    const assigneeChanged = oldAssignee !== newAssignee;

    if (
      assigneeChanged &&
      newAssignee !== null &&
      newAssignee !== Number(req.user.id)
    ) {
      await client.query(
        `INSERT INTO notifications
         (user_id, title, message)
         VALUES ($1, $2, $3)`,
        [
          newAssignee,
          "Task Reassigned",
          `You have been assigned the task: ${title}`,
        ],
      );
    }

    await client.query("COMMIT");

    /*
     * Create project activity after the main task transaction
     * has successfully committed.
     *
     * Activity logging must never break successful task updates.
     */
    if (assigneeChanged) {
      let reassignedUserName = "another user";

      if (newAssignee !== null) {
        const assigneeNameResult = await pool.query(
          `SELECT name
           FROM users
           WHERE id = $1`,
          [newAssignee],
        );

        if (assigneeNameResult.rows.length > 0) {
          reassignedUserName = assigneeNameResult.rows[0].name;
        }
      }

      await logProjectActivity(
        updatedTask.project_id,
        req.user.id,
        "TASK_REASSIGNED",
        `Task "${updatedTask.title}" was reassigned to ${reassignedUserName}`,
      );
    } else {
      await logProjectActivity(
        updatedTask.project_id,
        req.user.id,
        "TASK_UPDATED",
        `Task "${updatedTask.title}" was updated`,
      );
    }

    res.json(updatedTask);
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Task update error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  } finally {
    client.release();
  }
});

/*
 * Delete a task.
 */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    /*
     * First get the task and determine its workspace.
     */
    const taskResult = await pool.query(
      `SELECT tasks.id,
              tasks.created_by,
              teams.workspace_id
       FROM tasks
       JOIN projects
         ON tasks.project_id = projects.id
       JOIN teams
         ON projects.team_id = teams.id
       WHERE tasks.id = $1`,
      [req.params.id],
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const task = taskResult.rows[0];

    /*
     * Workspace-linked project:
     * Only TEAM_LEADER can delete.
     */
    if (task.workspace_id) {
      const leaderResult = await pool.query(
        `SELECT workspace_members.id
         FROM workspace_members
         JOIN workspaces
           ON workspace_members.workspace_id = workspaces.id
         WHERE workspace_members.workspace_id = $1
           AND workspace_members.user_id = $2
           AND workspace_members.role = 'TEAM_LEADER'
           AND workspaces.type IN ('PROJECT', 'COMPANY')`,
        [task.workspace_id, req.user.id],
      );

      if (leaderResult.rows.length === 0) {
        return res.status(403).json({
          error: "Only the Workspace Team Leader can delete this task",
        });
      }
    } else {
      /*
       * Preserve legacy behavior:
       * only task creator can delete.
       */
      if (task.created_by !== req.user.id) {
        return res.status(404).json({
          error: "Task not found or you are not the creator",
        });
      }
    }

    const result = await pool.query(
      `DELETE FROM tasks
       WHERE id = $1
       RETURNING *`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    res.json({
      message: "Task deleted successfully",
      task: result.rows[0],
    });
  } catch (error) {
    console.error("Task deletion error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

module.exports = router;
