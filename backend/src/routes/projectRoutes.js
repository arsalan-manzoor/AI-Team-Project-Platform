const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const { logProjectActivity } = require("../utils/projectActivity");

const router = express.Router();

/* ============================================================
   WORKSPACE CONSTANTS
============================================================ */

const SUPPORTED_WORKSPACE_TYPES = ["PROJECT", "COMPANY", "INDIVIDUAL"];

const PROJECT_MANAGEMENT_ROLES = ["TEAM_LEADER", "ADMIN", "HR"];

const COMPANY_PROJECT_MEMBER_ROLES = ["ADMIN", "HR", "TEAM_LEADER", "USER"];

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

  const firstNumber = Number(first);
  const secondNumber = Number(second);

  return (
    Number.isFinite(firstNumber) &&
    Number.isFinite(secondNumber) &&
    firstNumber === secondNumber
  );
}

function normalizeProjectId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    return null;
  }

  return normalized;
}

/* ============================================================
   WORKSPACE ROLE CHECK
============================================================ */

async function hasWorkspaceRole(workspaceId, userId, expectedRoles, db = pool) {
  const normalizedRoles = expectedRoles.map(normalizeRole);

  const result = await db.query(
    `
      SELECT 1

      FROM workspace_members wm

      JOIN workspaces w
        ON w.id = wm.workspace_id

      WHERE wm.workspace_id = $1
        AND wm.user_id = $2

        AND UPPER(
              TRIM(w.type::TEXT)
            ) = ANY($3::TEXT[])

        AND (
          UPPER(
            TRIM(COALESCE(wm.role::TEXT, ''))
          ) = ANY($4::TEXT[])

          OR EXISTS (
            SELECT 1

            FROM workspace_member_roles wmr

            WHERE wmr.workspace_member_id = wm.id

              AND UPPER(
                    TRIM(wmr.role::TEXT)
                  ) = ANY($4::TEXT[])
          )
        )

      LIMIT 1
    `,
    [workspaceId, userId, SUPPORTED_WORKSPACE_TYPES, normalizedRoles],
  );

  return result.rows.length > 0;
}

/* ============================================================
   GET A USER'S ROLES IN ONE EXACT WORKSPACE
============================================================ */

async function getWorkspaceRoles(workspaceId, userId, db = pool) {
  const result = await db.query(
    `
      SELECT UPPER(
        TRIM(wm.role::TEXT)
      ) AS role

      FROM workspace_members wm

      WHERE wm.workspace_id = $1
        AND wm.user_id = $2

      UNION

      SELECT UPPER(
        TRIM(wmr.role::TEXT)
      ) AS role

      FROM workspace_member_roles wmr

      JOIN workspace_members wm
        ON wm.id = wmr.workspace_member_id

      WHERE wm.workspace_id = $1
        AND wm.user_id = $2
    `,
    [workspaceId, userId],
  );

  return [
    ...new Set(
      result.rows.map((row) => normalizeRole(row.role)).filter(Boolean),
    ),
  ];
}

/* ============================================================
   RESOLVE EFFECTIVE WORKSPACE ROLE
============================================================ */

function getEffectiveWorkspaceRole(roles) {
  const priority = ["ADMIN", "HR", "TEAM_LEADER", "USER"];

  for (const role of priority) {
    if (roles.includes(role)) {
      return role;
    }
  }

  return roles[0] || null;
}

/* ============================================================
   VERIFY COMPANY WORKSPACE
============================================================ */

async function getVerifiedCompanyWorkspace(workspaceId, db = pool) {
  const result = await db.query(
    `
      SELECT
        w.id,
        w.name,
        w.type,
        w.organization_id,

        o.verification_status

      FROM workspaces w

      JOIN organizations o
        ON o.id = w.organization_id

      WHERE w.id = $1

        AND UPPER(TRIM(w.type::TEXT)) = 'COMPANY'

      LIMIT 1
    `,
    [workspaceId],
  );

  const workspace = result.rows[0];

  if (
    !workspace ||
    normalizeRole(workspace.verification_status) !== "VERIFIED"
  ) {
    return null;
  }

  return workspace;
}

/* ============================================================
   LOAD PROJECT AND ACTUAL WORKSPACE
============================================================ */

async function getProjectContext(projectId, db = pool) {
  const result = await db.query(
    `
      SELECT
        p.id,
        p.name,
        p.description,
        p.team_id,
        p.created_by,
        p.created_at,

        p.assigned_hr_user_id,

        COALESCE(
          p.workspace_id,
          t.workspace_id
        ) AS workspace_id,

        t.name AS team_name,

        w.name AS workspace_name,
        w.type AS workspace_type,
        w.organization_id,

        o.verification_status AS organization_verification_status

      FROM projects p

      LEFT JOIN teams t
        ON t.id = p.team_id

      LEFT JOIN workspaces w
        ON w.id = COALESCE(
          p.workspace_id,
          t.workspace_id
        )

      LEFT JOIN organizations o
        ON o.id = w.organization_id

      WHERE p.id = $1

      LIMIT 1
    `,
    [projectId],
  );

  return result.rows[0] || null;
}

/* ============================================================
   VERIFY COMPANY PROJECT
============================================================ */

function isVerifiedCompanyProject(project) {
  return (
    project &&
    project.workspace_id !== null &&
    project.workspace_id !== undefined &&
    normalizeRole(project.workspace_type) === "COMPANY" &&
    normalizeRole(project.organization_verification_status) === "VERIFIED"
  );
}

/* ============================================================
   CHECK PROJECT VISIBILITY
============================================================ */

/*
 * COMPANY WORKSPACE RULES
 *
 * ADMIN:
 *   Can access every project in the workspace.
 *
 * HR:
 *   Can access:
 *   - Projects assigned to them.
 *   - Projects created by them.
 *   - Team-based projects belonging to their assigned Team Leaders.
 *
 * TEAM_LEADER:
 *   Can access:
 *   - Independent projects directly assigned to them.
 *   - Projects attached to teams they lead.
 *
 * USER:
 *   Can access projects through explicit team/project membership.
 *
 * OTHER WORKSPACE TYPES:
 *   Existing management and membership behavior is preserved.
 */

async function canAccessProject(project, userId, db = pool) {
  if (!project) {
    return false;
  }

  if (project.workspace_id !== null && project.workspace_id !== undefined) {
    const roles = await getWorkspaceRoles(project.workspace_id, userId, db);

    /* ========================================================
       ADMIN
    ======================================================== */

    if (roles.includes("ADMIN")) {
      return true;
    }

    const isCompanyWorkspace =
      normalizeRole(project.workspace_type) === "COMPANY";

    /* ========================================================
       COMPANY WORKSPACE
    ======================================================== */

    if (isCompanyWorkspace) {
      /* ------------------------------------------------------
         HR
      ------------------------------------------------------ */

      if (roles.includes("HR")) {
        // HR sees projects assigned specifically to them.
        if (sameId(project.assigned_hr_user_id, userId)) {
          return true;
        }

        // HR sees projects created by them.
        if (sameId(project.created_by, userId)) {
          return true;
        }

        // HR sees team-based projects belonging to
        // Team Leaders assigned to that HR.
        if (project.team_id !== null && project.team_id !== undefined) {
          const hrTeamResult = await db.query(
            `
              SELECT 1

              FROM teams t

              JOIN organization_hr_team_leader_assignments a
                ON a.organization_id = $3

               AND a.hr_user_id = $2

               AND a.team_leader_user_id =
                   COALESCE(
                     t.team_leader_id,
                     t.created_by
                   )

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

          if (hrTeamResult.rows.length > 0) {
            return true;
          }
        }
      }

      /* ------------------------------------------------------
         TEAM LEADER
      ------------------------------------------------------ */

      if (
        roles.includes("TEAM_LEADER") &&
        project.team_id !== null &&
        project.team_id !== undefined
      ) {
        const teamResult = await db.query(
          `
            SELECT 1

            FROM teams

            WHERE id = $1
              AND workspace_id = $2

              AND COALESCE(
                team_leader_id,
                created_by
              ) = $3

            LIMIT 1
          `,
          [project.team_id, project.workspace_id, userId],
        );

        if (teamResult.rows.length > 0) {
          return true;
        }
      }

      /*
       * Independent Company projects are NOT automatically
       * visible to every Team Leader.
       *
       * Direct project membership is checked below.
       */
    } else {
      /* ======================================================
         NON-COMPANY WORKSPACES
         Preserve existing behavior.
      ====================================================== */

      if (
        project.team_id !== null &&
        project.team_id !== undefined &&
        roles.some((role) => PROJECT_MANAGEMENT_ROLES.includes(role))
      ) {
        return true;
      }

      if (
        (project.team_id === null || project.team_id === undefined) &&
        roles.includes("TEAM_LEADER")
      ) {
        return true;
      }
    }
  }

  /* ========================================================
     EXPLICIT TEAM / PROJECT MEMBERSHIP
  ======================================================== */

  const membershipResult = await db.query(
    `
      SELECT 1

      FROM team_members tm

      WHERE tm.team_id = $1
        AND tm.user_id = $2

      UNION

      SELECT 1

      FROM project_members pm

      WHERE pm.project_id = $3
        AND pm.user_id = $2

      LIMIT 1
    `,
    [project.team_id, userId, project.id],
  );

  return membershipResult.rows.length > 0;
}

/* ============================================================
   COMPANY PROJECT: LIST ELIGIBLE MEMBERS
============================================================ */

async function getEligibleCompanyProjectMembers(
  project,
  requesterId,
  requesterRole,
  db = pool,
) {
  const result = await db.query(
    `
      SELECT
        wm.user_id,

        u.name,
        u.email,

        UPPER(
          TRIM(wm.role::TEXT)
        ) AS workspace_role,

        u.account_status

      FROM workspace_members wm

      JOIN users u
        ON u.id = wm.user_id

      WHERE wm.workspace_id = $1

        AND u.account_status = 'ACTIVE'

        AND UPPER(
          TRIM(wm.role::TEXT)
        ) = ANY($2::TEXT[])

        AND wm.user_id <> $3

        AND NOT EXISTS (
          SELECT 1

          FROM project_members pm

          WHERE pm.project_id = $4
            AND pm.user_id = wm.user_id
        )

        AND NOT EXISTS (
          SELECT 1

          FROM team_members tm

          WHERE tm.team_id = $5
            AND tm.user_id = wm.user_id
        )

        AND (
          $6 = 'ADMIN'

          OR

          (
            $6 = 'HR'

            AND UPPER(
              TRIM(wm.role::TEXT)
            ) = 'TEAM_LEADER'

            AND EXISTS (
              SELECT 1

              FROM organization_hr_team_leader_assignments a

              WHERE a.organization_id = $7

                AND a.hr_user_id = $3

                AND a.team_leader_user_id = wm.user_id
            )
          )

          OR

          (
            $6 = 'HR'

            AND UPPER(
              TRIM(wm.role::TEXT)
            ) = 'USER'

            AND EXISTS (
              SELECT 1

              FROM organization_team_leader_user_assignments ua

              JOIN organization_hr_team_leader_assignments ha
                ON ha.organization_id = ua.organization_id

               AND ha.team_leader_user_id =
                   ua.team_leader_user_id

              WHERE ua.organization_id = $7

                AND ha.hr_user_id = $3

                AND ua.user_id = wm.user_id
            )
          )

          OR

          (
            $6 = 'TEAM_LEADER'

            AND UPPER(
              TRIM(wm.role::TEXT)
            ) = 'USER'

            AND EXISTS (
              SELECT 1

              FROM organization_team_leader_user_assignments ua

              WHERE ua.organization_id = $7

                AND ua.team_leader_user_id = $3

                AND ua.user_id = wm.user_id
            )
          )
        )

      ORDER BY
        LOWER(COALESCE(u.name, '')),
        wm.user_id
    `,
    [
      project.workspace_id,
      COMPANY_PROJECT_MEMBER_ROLES,
      requesterId,
      project.id,
      project.team_id,
      requesterRole,
      project.organization_id,
    ],
  );

  return result.rows;
}

/* ============================================================
   CREATE A PROJECT
============================================================ */

/*
 * POST /api/projects
 *
 * COMPANY INDEPENDENT PROJECT:
 *
 * ADMIN:
 *   Must assign an ACTIVE HR employee.
 *
 * HR:
 *   Creates a project assigned to themselves as HR.
 *   Must assign one of their eligible Team Leaders.
 *   The Team Leader receives direct project membership.
 *
 * TEAM-BASED PROJECT CREATION:
 *   Existing Team Leader rules remain unchanged.
 */

router.post("/", authMiddleware, async (req, res) => {
  const { name, description, teamId, workspaceId, assignedHrUserId } =
    req.body || {};

  const normalizedName = typeof name === "string" ? name.trim() : "";

  const teamIdWasProvided =
    teamId !== null && teamId !== undefined && teamId !== "";

  const normalizedTeamId = teamIdWasProvided
    ? normalizeProjectId(teamId)
    : null;

  const workspaceIdWasProvided =
    workspaceId !== null && workspaceId !== undefined && workspaceId !== "";

  const normalizedWorkspaceId = workspaceIdWasProvided
    ? normalizeProjectId(workspaceId)
    : null;

  if (!normalizedName) {
    return res.status(400).json({
      error: "A valid project name is required.",
    });
  }

  if (teamIdWasProvided && normalizedTeamId === null) {
    return res.status(400).json({
      error: "A valid team ID is required.",
    });
  }

  if (workspaceIdWasProvided && normalizedWorkspaceId === null) {
    return res.status(400).json({
      error: "A valid workspace ID is required.",
    });
  }

  /* ========================================================
     COMPANY ADMIN / HR: INDEPENDENT PROJECT
  ======================================================== */

  if (!teamIdWasProvided) {
    if (normalizedWorkspaceId === null) {
      return res.status(400).json({
        error:
          "A Company Workspace ID is required when creating a project without a team.",
      });
    }

    const normalizedAssignedHrId = normalizeProjectId(assignedHrUserId);

    const normalizedAssignedTeamLeaderId = normalizeProjectId(
      req.body?.assignedTeamLeaderUserId,
    );

    try {
      const workspace = await getVerifiedCompanyWorkspace(
        normalizedWorkspaceId,
      );

      if (!workspace) {
        return res.status(403).json({
          error: "A verified Company Workspace is required.",
        });
      }

      const requesterRoles = await getWorkspaceRoles(
        normalizedWorkspaceId,
        req.user.id,
      );

      const requesterRole = getEffectiveWorkspaceRole(requesterRoles);

      if (requesterRole !== "ADMIN" && requesterRole !== "HR") {
        return res.status(403).json({
          error:
            "Only the Company Admin or an assigned HR employee can create an independent project.",
        });
      }

      let assignedHr;
      let assignedTeamLeader = null;

      /* ------------------------------------------------------
         ADMIN CREATES PROJECT AND ASSIGNS HR
      ------------------------------------------------------ */

      if (requesterRole === "ADMIN") {
        if (normalizedAssignedHrId === null) {
          return res.status(400).json({
            error: "Please assign this project to an HR employee.",
          });
        }

        const hrResult = await pool.query(
          `
            SELECT
              u.id,
              u.name,
              u.email,
              u.account_status

            FROM workspace_members wm

            JOIN users u
              ON u.id = wm.user_id

            WHERE wm.workspace_id = $1
              AND wm.user_id = $2

            LIMIT 1
          `,
          [normalizedWorkspaceId, normalizedAssignedHrId],
        );

        if (hrResult.rows.length === 0) {
          return res.status(400).json({
            error:
              "The selected HR employee does not belong to this Company Workspace.",
          });
        }

        assignedHr = hrResult.rows[0];

        if (normalizeRole(assignedHr.account_status) !== "ACTIVE") {
          return res.status(400).json({
            error: "The selected HR employee is not active.",
          });
        }

        const hrRoles = await getWorkspaceRoles(
          normalizedWorkspaceId,
          normalizedAssignedHrId,
        );

        if (!hrRoles.includes("HR")) {
          return res.status(400).json({
            error:
              "The selected employee does not have the HR role in this Company Workspace.",
          });
        }
      } else {
        /* ----------------------------------------------------
           HR CREATES PROJECT AND ASSIGNS THEIR TEAM LEADER
        ---------------------------------------------------- */

        assignedHr = {
          id: req.user.id,
          name: req.user.name || "HR",
          email: req.user.email || null,
        };

        if (normalizedAssignedTeamLeaderId === null) {
          return res.status(400).json({
            error: "Please assign this project to one of your Team Leaders.",
          });
        }

        const teamLeaderResult = await pool.query(
          `
            SELECT
              u.id,
              u.name,
              u.email,
              u.account_status

            FROM workspace_members wm

            JOIN users u
              ON u.id = wm.user_id

            WHERE wm.workspace_id = $1
              AND wm.user_id = $2

            LIMIT 1
          `,
          [normalizedWorkspaceId, normalizedAssignedTeamLeaderId],
        );

        if (teamLeaderResult.rows.length === 0) {
          return res.status(400).json({
            error:
              "The selected Team Leader does not belong to this Company Workspace.",
          });
        }

        assignedTeamLeader = teamLeaderResult.rows[0];

        if (normalizeRole(assignedTeamLeader.account_status) !== "ACTIVE") {
          return res.status(400).json({
            error: "The selected Team Leader is not active.",
          });
        }

        const teamLeaderRoles = await getWorkspaceRoles(
          normalizedWorkspaceId,
          normalizedAssignedTeamLeaderId,
        );

        if (!teamLeaderRoles.includes("TEAM_LEADER")) {
          return res.status(400).json({
            error:
              "The selected employee does not have the Team Leader role in this Company Workspace.",
          });
        }

        const assignmentResult = await pool.query(
          `
            SELECT 1

            FROM organization_hr_team_leader_assignments a

            WHERE a.organization_id = $1
              AND a.hr_user_id = $2
              AND a.team_leader_user_id = $3

            LIMIT 1
          `,
          [
            workspace.organization_id,
            req.user.id,
            normalizedAssignedTeamLeaderId,
          ],
        );

        if (assignmentResult.rows.length === 0) {
          return res.status(403).json({
            error:
              "You can assign this project only to a Team Leader assigned to you.",
          });
        }
      }

      /* ------------------------------------------------------
         CREATE PROJECT TRANSACTION
      ------------------------------------------------------ */

      const client = await pool.connect();

      let transactionStarted = false;
      let createdProject;

      try {
        await client.query("BEGIN");
        transactionStarted = true;

        const projectResult = await client.query(
          `
            INSERT INTO projects (
              name,
              description,
              team_id,
              created_by,
              workspace_id,
              assigned_hr_user_id
            )

            VALUES ($1, $2, NULL, $3, $4, $5)

            RETURNING *
          `,
          [
            normalizedName,

            typeof description === "string" && description.trim()
              ? description.trim()
              : null,

            req.user.id,
            normalizedWorkspaceId,
            assignedHr.id,
          ],
        );

        createdProject = projectResult.rows[0];

        if (assignedTeamLeader) {
          await client.query(
            `
              INSERT INTO project_members (
                project_id,
                user_id,
                role
              )

              VALUES ($1, $2, 'TEAM_LEADER')

              ON CONFLICT (project_id, user_id)
              DO NOTHING
            `,
            [createdProject.id, assignedTeamLeader.id],
          );

          await client.query(
            `
              INSERT INTO notifications (
                user_id,
                title,
                message,
                notification_type,
                reference_id
              )

              VALUES ($1, $2, $3, $4, $5)
            `,
            [
              assignedTeamLeader.id,
              "New project assigned",
              `HR assigned you to the project "${createdProject.name}". Create your team and attach it to this project.`,
              "PROJECT_ASSIGNED",
              createdProject.id,
            ],
          );
        }

        await client.query("COMMIT");
        transactionStarted = false;
      } catch (transactionError) {
        if (transactionStarted) {
          await client.query("ROLLBACK");
        }

        throw transactionError;
      } finally {
        client.release();
      }

      /* ------------------------------------------------------
         PROJECT ACTIVITY
      ------------------------------------------------------ */

      try {
        await logProjectActivity(
          createdProject.id,
          req.user.id,
          "PROJECT_CREATED",
          assignedTeamLeader
            ? `Company project "${createdProject.name}" was created by HR and assigned to Team Leader ${assignedTeamLeader.name}.`
            : `Company project "${createdProject.name}" was created and assigned to HR employee ${assignedHr.name}.`,
        );
      } catch (activityError) {
        console.error(
          "Project creation activity logging error:",
          activityError.message,
        );
      }

      return res.status(201).json({
        message: assignedTeamLeader
          ? "Company project created and assigned to the Team Leader successfully."
          : "Company project created and assigned to HR successfully.",

        ...createdProject,

        workspace: {
          id: workspace.id,
          name: workspace.name,
          type: workspace.type,
        },

        assigned_hr: {
          id: assignedHr.id,
          name: assignedHr.name,
          email: assignedHr.email,
        },

        ...(assignedTeamLeader
          ? {
              assigned_team_leader: {
                id: assignedTeamLeader.id,
                name: assignedTeamLeader.name,
                email: assignedTeamLeader.email,
              },
            }
          : {}),
      });
    } catch (error) {
      console.error(
        "Independent Company project creation error:",
        error.message,
      );

      if (error.code === "23503") {
        return res.status(404).json({
          error:
            "The workspace, assigned employee, or creator could not be found.",
        });
      }

      if (error.code === "23505") {
        return res.status(409).json({
          error: "This Team Leader is already assigned to this project.",
        });
      }

      return res.status(500).json({
        error: "Unable to create the Company project.",
      });
    }
  }

  /* ========================================================
     EXISTING TEAM-BASED PROJECT CREATION
     PRESERVED
  ======================================================== */

  try {
    const teamResult = await pool.query(
      `
        SELECT
          id,
          workspace_id,
          created_by

        FROM teams

        WHERE id = $1

        LIMIT 1
      `,
      [normalizedTeamId],
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        error: "Team not found",
      });
    }

    const team = teamResult.rows[0];

    /* --------------------------------------------------------
       PREVENT WORKSPACE / TEAM MISMATCH
    -------------------------------------------------------- */

    if (team.workspace_id !== null) {
      if (normalizedWorkspaceId === null) {
        return res.status(400).json({
          error:
            "The active workspace ID is required when creating a project in a workspace.",
        });
      }

      if (!sameId(team.workspace_id, normalizedWorkspaceId)) {
        return res.status(403).json({
          error: "The selected team does not belong to the active workspace.",
        });
      }
    } else if (workspaceIdWasProvided) {
      return res.status(403).json({
        error: "The selected team is not linked to the active workspace.",
      });
    }

    /* --------------------------------------------------------
       AUTHORIZE WORKSPACE PROJECT CREATION
    -------------------------------------------------------- */

    if (team.workspace_id !== null) {
      const isTeamLeader = await hasWorkspaceRole(
        team.workspace_id,
        req.user.id,
        ["TEAM_LEADER"],
      );

      if (!isTeamLeader) {
        return res.status(403).json({
          error:
            "Only the Workspace Team Leader can create a project in this workspace",
        });
      }
    } else {
      const memberResult = await pool.query(
        `
          SELECT user_id

          FROM team_members

          WHERE team_id = $1
            AND user_id = $2

          LIMIT 1
        `,
        [normalizedTeamId, req.user.id],
      );

      if (memberResult.rows.length === 0) {
        return res.status(403).json({
          error: "You are not a member of this team",
        });
      }
    }

    /* --------------------------------------------------------
       INSERT PROJECT
    -------------------------------------------------------- */

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
        normalizedName,

        typeof description === "string" && description.trim()
          ? description.trim()
          : null,

        normalizedTeamId,
        req.user.id,
      ],
    );

    const createdProject = result.rows[0];

    /* --------------------------------------------------------
       PROJECT ACTIVITY
    -------------------------------------------------------- */

    try {
      await logProjectActivity(
        createdProject.id,
        req.user.id,
        "PROJECT_CREATED",
        `Project "${createdProject.name}" was created`,
      );
    } catch (activityError) {
      console.error(
        "Project creation activity logging error:",
        activityError.message,
      );
    }

    return res.status(201).json(createdProject);
  } catch (error) {
    console.error("Project creation error:", error.message);

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

/* ============================================================
   ATTACH INDEPENDENT COMPANY PROJECT TO A TEAM
============================================================ */

/*
 * PATCH /api/projects/:id/attach-team
 *
 * Rules:
 *
 * 1. Project must be an independent verified Company project.
 * 2. Project must not already have a team.
 * 3. Requester must be a Team Leader.
 * 4. Selected team must belong to the same Company Workspace.
 * 5. Requester must lead the selected team.
 * 6. Requester must have direct TEAM_LEADER project assignment.
 *
 * This final condition ensures that a Team Leader cannot attach
 * an Admin-assigned project before HR has handed it over.
 */

router.patch("/:id/attach-team", authMiddleware, async (req, res) => {
  const projectId = normalizeProjectId(req.params.id);

  const teamId = normalizeProjectId(req.body?.teamId);

  if (projectId === null || teamId === null) {
    return res.status(400).json({
      error: "A valid project ID and team ID are required.",
    });
  }

  const client = await pool.connect();

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    /* --------------------------------------------------------
       LOCK AND LOAD PROJECT
    -------------------------------------------------------- */

    const lockedProject = await client.query(
      `
        SELECT id

        FROM projects

        WHERE id = $1

        FOR UPDATE
      `,
      [projectId],
    );

    if (lockedProject.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        error: "Project not found.",
      });
    }

    const project = await getProjectContext(projectId, client);

    if (!project || !isVerifiedCompanyProject(project)) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error:
          "Only verified Company Workspace projects can be attached to a team.",
      });
    }

    /* --------------------------------------------------------
       PROJECT MUST BE INDEPENDENT
    -------------------------------------------------------- */

    if (project.team_id !== null && project.team_id !== undefined) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        error: "This project is already attached to a team.",
      });
    }

    /* --------------------------------------------------------
       REQUIRE TEAM LEADER ROLE
    -------------------------------------------------------- */

    const requesterRoles = await getWorkspaceRoles(
      project.workspace_id,
      req.user.id,
      client,
    );

    if (!requesterRoles.includes("TEAM_LEADER")) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error:
          "Only a Team Leader in this Company Workspace can attach the project to a team.",
      });
    }

    /* --------------------------------------------------------
       VERIFY DIRECT PROJECT ASSIGNMENT
    -------------------------------------------------------- */

    const assignedLeaderResult = await client.query(
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
      [project.id, req.user.id],
    );

    if (assignedLeaderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error:
          "This project has not been handed over to you. Ask your HR or Admin to assign it to you first.",
      });
    }

    /* --------------------------------------------------------
       LOAD SELECTED TEAM
    -------------------------------------------------------- */

    const teamResult = await client.query(
      `
        SELECT
          id,
          name,
          workspace_id,
          team_leader_id,
          created_by

        FROM teams

        WHERE id = $1

        LIMIT 1

        FOR UPDATE
      `,
      [teamId],
    );

    if (teamResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        error: "Selected team not found.",
      });
    }

    const team = teamResult.rows[0];

    /* --------------------------------------------------------
       TEAM MUST BELONG TO SAME COMPANY WORKSPACE
    -------------------------------------------------------- */

    if (!sameId(team.workspace_id, project.workspace_id)) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error:
          "The selected team does not belong to this project's Company Workspace.",
      });
    }

    /* --------------------------------------------------------
       RESOLVE RESPONSIBLE TEAM LEADER
    -------------------------------------------------------- */

    const responsibleTeamLeaderId = team.team_leader_id ?? team.created_by;

    if (!sameId(responsibleTeamLeaderId, req.user.id)) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error: "You can only attach a project to a team that you lead.",
      });
    }

    /* --------------------------------------------------------
       ATTACH PROJECT
    -------------------------------------------------------- */

    const updateResult = await client.query(
      `
        UPDATE projects

        SET team_id = $1

        WHERE id = $2
          AND team_id IS NULL
          AND workspace_id = $3

        RETURNING *
      `,
      [team.id, project.id, project.workspace_id],
    );

    if (updateResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        error:
          "The project could not be attached. It may have already been assigned to another team.",
      });
    }

    await client.query("COMMIT");
    transactionStarted = false;

    /* --------------------------------------------------------
       PROJECT ACTIVITY
    -------------------------------------------------------- */

    try {
      await logProjectActivity(
        project.id,
        req.user.id,
        "PROJECT_ATTACHED_TO_TEAM",
        `Project "${project.name}" was attached to team "${team.name}".`,
      );
    } catch (activityError) {
      console.error(
        "Project attachment activity logging error:",
        activityError.message,
      );
    }

    return res.status(200).json({
      message: "Project successfully attached to the team.",

      project: {
        ...updateResult.rows[0],
        workspace_id: project.workspace_id,
        assigned_hr_user_id: project.assigned_hr_user_id,
      },

      team: {
        id: team.id,
        name: team.name,
      },

      workspace: {
        id: project.workspace_id,
        name: project.workspace_name,
        type: project.workspace_type,
      },
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Project attachment rollback error:",
          rollbackError.message,
        );
      }
    }

    console.error("Project attachment error:", error.message);

    if (error.code === "23503") {
      return res.status(404).json({
        error: "The project, team, or workspace could not be found.",
      });
    }

    return res.status(500).json({
      error: "Unable to attach the project to the selected team.",
    });
  } finally {
    client.release();
  }
});

/* ============================================================
   GET PROJECTS ACCESSIBLE TO THE CURRENT USER
============================================================ */

/*
 * COMPANY WORKSPACE VISIBILITY
 *
 * ADMIN:
 *   All Company projects.
 *
 * HR:
 *   Projects assigned to them.
 *   Projects created by them.
 *   Projects under their assigned Team Leaders.
 *
 * TEAM_LEADER:
 *   Projects directly assigned to them.
 *   Projects attached to their own teams.
 *
 * USER:
 *   Projects through direct project/team membership.
 *
 * IMPORTANT:
 *   Every Team Leader must not automatically see every
 *   independent Company project.
 */

router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          p.id,
          p.name,
          p.description,
          p.team_id,
          p.created_by,
          p.created_at,

          p.assigned_hr_user_id,

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

        WHERE

          /* --------------------------------------------------
             EXPLICIT TEAM MEMBERSHIP
          -------------------------------------------------- */

          EXISTS (
            SELECT 1

            FROM team_members tm

            WHERE tm.team_id = p.team_id
              AND tm.user_id = $1
          )

          OR

          /* --------------------------------------------------
             EXPLICIT PROJECT MEMBERSHIP
          -------------------------------------------------- */

          EXISTS (
            SELECT 1

            FROM project_members pm

            WHERE pm.project_id = p.id
              AND pm.user_id = $1
          )

          OR

          /* --------------------------------------------------
             WORKSPACE ROLE VISIBILITY
          -------------------------------------------------- */

          (
            COALESCE(
              p.workspace_id,
              t.workspace_id
            ) IS NOT NULL

            AND EXISTS (
              SELECT 1

              FROM workspace_members wm

              JOIN workspaces role_workspace
                ON role_workspace.id = wm.workspace_id

              WHERE wm.workspace_id = COALESCE(
                  p.workspace_id,
                  t.workspace_id
                )

                AND wm.user_id = $1

                AND UPPER(
                  TRIM(role_workspace.type::TEXT)
                ) = ANY($2::TEXT[])

                AND (

                  /* ==========================================
                     ADMIN
                  ========================================== */

                  UPPER(
                    TRIM(COALESCE(wm.role::TEXT, ''))
                  ) = 'ADMIN'

                  OR EXISTS (
                    SELECT 1

                    FROM workspace_member_roles wmr

                    WHERE wmr.workspace_member_id = wm.id

                      AND UPPER(
                        TRIM(wmr.role::TEXT)
                      ) = 'ADMIN'
                  )

                  OR

                  /* ==========================================
                     COMPANY WORKSPACE RULES
                  ========================================== */

                  (
                    UPPER(
                      TRIM(role_workspace.type::TEXT)
                    ) = 'COMPANY'

                    AND (

                      /* --------------------------------------
                         HR VISIBILITY
                      -------------------------------------- */

                      (
                        (
                          UPPER(
                            TRIM(COALESCE(wm.role::TEXT, ''))
                          ) = 'HR'

                          OR EXISTS (
                            SELECT 1

                            FROM workspace_member_roles wmr

                            WHERE wmr.workspace_member_id = wm.id

                              AND UPPER(
                                TRIM(wmr.role::TEXT)
                              ) = 'HR'
                          )
                        )

                        AND (

                          /* HR-assigned projects. */
                          p.assigned_hr_user_id = $1

                          OR

                          /* Projects created by this HR. */
                          p.created_by = $1

                          OR

                          /* Projects under assigned Team Leaders. */
                          (
                            p.team_id IS NOT NULL

                            AND EXISTS (
                              SELECT 1

                              FROM teams scope_team

                              JOIN organization_hr_team_leader_assignments a
                                ON a.organization_id =
                                   role_workspace.organization_id

                               AND a.hr_user_id = $1

                               AND a.team_leader_user_id =
                                   COALESCE(
                                     scope_team.team_leader_id,
                                     scope_team.created_by
                                   )

                              WHERE scope_team.id = p.team_id
                                AND scope_team.workspace_id =
                                    role_workspace.id
                            )
                          )
                        )
                      )

                      OR

                      /* --------------------------------------
                         TEAM LEADER VISIBILITY
                      -------------------------------------- */

                      (
                        (
                          UPPER(
                            TRIM(COALESCE(wm.role::TEXT, ''))
                          ) = 'TEAM_LEADER'

                          OR EXISTS (
                            SELECT 1

                            FROM workspace_member_roles wmr

                            WHERE wmr.workspace_member_id = wm.id

                              AND UPPER(
                                TRIM(wmr.role::TEXT)
                              ) = 'TEAM_LEADER'
                          )
                        )

                        AND p.team_id IS NOT NULL

                        AND EXISTS (
                          SELECT 1

                          FROM teams scope_team

                          WHERE scope_team.id = p.team_id

                            AND scope_team.workspace_id =
                                role_workspace.id

                            AND COALESCE(
                              scope_team.team_leader_id,
                              scope_team.created_by
                            ) = $1
                        )
                      )
                    )
                  )

                  OR

                  /* ==========================================
                     OTHER WORKSPACE TYPES
                     PRESERVE EXISTING RULES
                  ========================================== */

                  (
                    UPPER(
                      TRIM(role_workspace.type::TEXT)
                    ) <> 'COMPANY'

                    AND (

                      /* Existing team-based management. */
                      (
                        p.team_id IS NOT NULL

                        AND (
                          UPPER(
                            TRIM(COALESCE(wm.role::TEXT, ''))
                          ) = ANY($3::TEXT[])

                          OR EXISTS (
                            SELECT 1

                            FROM workspace_member_roles wmr

                            WHERE wmr.workspace_member_id = wm.id

                              AND UPPER(
                                TRIM(wmr.role::TEXT)
                              ) = ANY($3::TEXT[])
                          )
                        )
                      )

                      OR

                      /* Existing independent Team Leader access. */
                      (
                        p.team_id IS NULL

                        AND (
                          UPPER(
                            TRIM(COALESCE(wm.role::TEXT, ''))
                          ) = 'TEAM_LEADER'

                          OR EXISTS (
                            SELECT 1

                            FROM workspace_member_roles wmr

                            WHERE wmr.workspace_member_id = wm.id

                              AND UPPER(
                                TRIM(wmr.role::TEXT)
                              ) = 'TEAM_LEADER'
                          )
                        )
                      )
                    )
                  )
                )
            )
          )

        ORDER BY
          p.created_at DESC NULLS LAST,
          p.id DESC
      `,
      [req.user.id, SUPPORTED_WORKSPACE_TYPES, PROJECT_MANAGEMENT_ROLES],
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Project fetch error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/* ============================================================
   GET PROJECT MEMBERS
============================================================ */

router.get("/:id/members", authMiddleware, async (req, res) => {
  const projectId = normalizeProjectId(req.params.id);

  if (projectId === null) {
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

    if (!isVerifiedCompanyProject(project)) {
      return res.status(403).json({
        error:
          "Project member management is available only for verified Company Workspace projects.",
      });
    }

    /* --------------------------------------------------------
       VERIFY ACTUAL PROJECT ACCESS
    -------------------------------------------------------- */

    const canViewProject = await canAccessProject(project, req.user.id);

    if (!canViewProject) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const membersResult = await pool.query(
      `
        WITH member_ids AS (

          SELECT tm.user_id

          FROM team_members tm

          WHERE tm.team_id = $1

          UNION

          SELECT pm.user_id

          FROM project_members pm

          WHERE pm.project_id = $2
        )

        SELECT
          u.id AS user_id,
          u.name,
          u.email,

          UPPER(
            TRIM(wm.role::TEXT)
          ) AS workspace_role,

          u.account_status,

          CASE
            WHEN EXISTS (
              SELECT 1

              FROM team_members tm

              WHERE tm.team_id = $1
                AND tm.user_id = u.id
            )
            THEN 'TEAM'

            ELSE 'PROJECT'
          END AS membership_source

        FROM member_ids mi

        JOIN workspace_members wm
          ON wm.workspace_id = $3
         AND wm.user_id = mi.user_id

        JOIN users u
          ON u.id = wm.user_id

        ORDER BY
          CASE UPPER(TRIM(wm.role::TEXT))
            WHEN 'ADMIN' THEN 1
            WHEN 'HR' THEN 2
            WHEN 'TEAM_LEADER' THEN 3
            WHEN 'USER' THEN 4
            ELSE 5
          END,

          LOWER(COALESCE(u.name, '')),
          u.id
      `,
      [project.team_id, project.id, project.workspace_id],
    );

    return res.status(200).json({
      project: {
        id: project.id,
        name: project.name,
        team_id: project.team_id,
        assigned_hr_user_id: project.assigned_hr_user_id,
      },

      workspace: {
        id: project.workspace_id,
        name: project.workspace_name,
        type: project.workspace_type,
      },

      members: membersResult.rows,
    });
  } catch (error) {
    console.error("Get project members error:", error.message);

    return res.status(500).json({
      error: "Unable to retrieve project members.",
    });
  }
});

/* ============================================================
   GET ELIGIBLE PROJECT MEMBERS
============================================================ */

router.get("/:id/eligible-members", authMiddleware, async (req, res) => {
  const projectId = normalizeProjectId(req.params.id);

  if (projectId === null) {
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

    if (!isVerifiedCompanyProject(project)) {
      return res.status(403).json({
        error:
          "Adding project members is available only for verified Company Workspace projects.",
      });
    }

    /* --------------------------------------------------------
       VERIFY ACTUAL PROJECT ACCESS
    -------------------------------------------------------- */

    const canViewProject = await canAccessProject(project, req.user.id);

    if (!canViewProject) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const requesterRoles = await getWorkspaceRoles(
      project.workspace_id,
      req.user.id,
    );

    if (requesterRoles.length === 0) {
      return res.status(403).json({
        error: "You are not a member of this Company Workspace.",
      });
    }

    const requesterRole = getEffectiveWorkspaceRole(requesterRoles);

    if (!["ADMIN", "HR", "TEAM_LEADER"].includes(requesterRole)) {
      return res.status(403).json({
        error:
          "Your Company Workspace role does not allow you to add project members.",
      });
    }

    const members = await getEligibleCompanyProjectMembers(
      project,
      req.user.id,
      requesterRole,
    );

    return res.status(200).json({
      project: {
        id: project.id,
        name: project.name,
      },

      workspace: {
        id: project.workspace_id,
        name: project.workspace_name,
        type: project.workspace_type,
      },

      requester_role: requesterRole,

      members,
    });
  } catch (error) {
    console.error("Get eligible project members error:", error.message);

    return res.status(500).json({
      error: "Unable to retrieve eligible project members.",
    });
  }
});

/* ============================================================
   ADD A MEMBER TO A COMPANY PROJECT
============================================================ */

router.post("/:id/members", authMiddleware, async (req, res) => {
  const projectId = normalizeProjectId(req.params.id);

  const userId = normalizeProjectId(req.body?.userId);

  if (projectId === null) {
    return res.status(400).json({
      error: "Invalid project ID",
    });
  }

  if (userId === null) {
    return res.status(400).json({
      error: "A valid user ID is required.",
    });
  }

  if (sameId(userId, req.user.id)) {
    return res.status(400).json({
      error: "You cannot add yourself through the Add Members feature.",
    });
  }

  const client = await pool.connect();

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const project = await getProjectContext(projectId, client);

    if (!project) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        error: "Project not found",
      });
    }

    if (!isVerifiedCompanyProject(project)) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error:
          "Members can be added through this endpoint only to verified Company Workspace projects.",
      });
    }

    /* --------------------------------------------------------
       VERIFY ACTUAL PROJECT ACCESS
    -------------------------------------------------------- */

    const canManageProject = await canAccessProject(
      project,
      req.user.id,
      client,
    );

    if (!canManageProject) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        error: "Project not found",
      });
    }

    const requesterRoles = await getWorkspaceRoles(
      project.workspace_id,
      req.user.id,
      client,
    );

    if (requesterRoles.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error: "You are not a member of this Company Workspace.",
      });
    }

    const requesterRole = getEffectiveWorkspaceRole(requesterRoles);

    if (!["ADMIN", "HR", "TEAM_LEADER"].includes(requesterRole)) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error:
          "Your Company Workspace role does not allow you to add project members.",
      });
    }

    /* --------------------------------------------------------
       LOAD TARGET MEMBER
    -------------------------------------------------------- */

    const targetResult = await client.query(
      `
        SELECT
          wm.user_id,

          UPPER(
            TRIM(wm.role::TEXT)
          ) AS workspace_role,

          u.name,
          u.email,
          u.account_status

        FROM workspace_members wm

        JOIN workspaces w
          ON w.id = wm.workspace_id

        JOIN users u
          ON u.id = wm.user_id

        WHERE wm.workspace_id = $1
          AND wm.user_id = $2

          AND UPPER(
            TRIM(w.type::TEXT)
          ) = 'COMPANY'

        LIMIT 1
      `,
      [project.workspace_id, userId],
    );

    if (targetResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error: "The selected person is not a member of this Company Workspace.",
      });
    }

    const target = targetResult.rows[0];

    if (normalizeRole(target.account_status) !== "ACTIVE") {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error:
          "Only active Company Workspace members can be added to a project.",
      });
    }

    /* --------------------------------------------------------
       PREVENT DUPLICATE MEMBERSHIP
    -------------------------------------------------------- */

    const duplicateResult = await client.query(
      `
        SELECT 1

        FROM project_members

        WHERE project_id = $1
          AND user_id = $2

        UNION

        SELECT 1

        FROM team_members

        WHERE team_id = $3
          AND user_id = $2

        LIMIT 1
      `,
      [project.id, userId, project.team_id],
    );

    if (duplicateResult.rows.length > 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        error:
          "This person already has access to the project through project or team membership.",
      });
    }

    /* --------------------------------------------------------
       VALIDATE ROLE AND REPORTING ASSIGNMENT
    -------------------------------------------------------- */

    const targetRole = normalizeRole(target.workspace_role);

    let targetIsEligible = false;

    if (requesterRole === "ADMIN") {
      targetIsEligible = COMPANY_PROJECT_MEMBER_ROLES.includes(targetRole);
    } else if (requesterRole === "HR") {
      if (targetRole === "TEAM_LEADER") {
        const assignmentResult = await client.query(
          `
            SELECT 1

            FROM organization_hr_team_leader_assignments a

            WHERE a.organization_id = $1
              AND a.hr_user_id = $2
              AND a.team_leader_user_id = $3

            LIMIT 1
          `,
          [project.organization_id, req.user.id, userId],
        );

        targetIsEligible = assignmentResult.rows.length > 0;
      } else if (targetRole === "USER") {
        const assignmentResult = await client.query(
          `
            SELECT 1

            FROM organization_team_leader_user_assignments ua

            JOIN organization_hr_team_leader_assignments ha
              ON ha.organization_id = ua.organization_id

             AND ha.team_leader_user_id =
                 ua.team_leader_user_id

            WHERE ua.organization_id = $1
              AND ha.hr_user_id = $2
              AND ua.user_id = $3

            LIMIT 1
          `,
          [project.organization_id, req.user.id, userId],
        );

        targetIsEligible = assignmentResult.rows.length > 0;
      }
    } else if (requesterRole === "TEAM_LEADER") {
      if (targetRole === "USER") {
        const assignmentResult = await client.query(
          `
            SELECT 1

            FROM organization_team_leader_user_assignments ua

            WHERE ua.organization_id = $1
              AND ua.team_leader_user_id = $2
              AND ua.user_id = $3

            LIMIT 1
          `,
          [project.organization_id, req.user.id, userId],
        );

        targetIsEligible = assignmentResult.rows.length > 0;
      }
    }

    if (!targetIsEligible) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error:
          "You cannot add this member. The person's Company Workspace role or reporting assignment does not allow it.",
      });
    }

    /* --------------------------------------------------------
       INSERT PROJECT MEMBERSHIP
    -------------------------------------------------------- */

    const membershipResult = await client.query(
      `
        INSERT INTO project_members (
          project_id,
          user_id,
          role
        )

        VALUES ($1, $2, $3)

        RETURNING
          id,
          project_id,
          user_id,
          role,
          joined_at
      `,
      [project.id, userId, targetRole],
    );

    const membership = membershipResult.rows[0];

    /* --------------------------------------------------------
       CREATE NOTIFICATION
    -------------------------------------------------------- */

    await client.query(
      `
        INSERT INTO notifications (
          user_id,
          title,
          message,
          notification_type,
          reference_id
        )

        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        userId,
        "Added to a project",
        `You have been added to the project "${project.name}" in your Company Workspace.`,
        "PROJECT_MEMBER_ADDED",
        project.id,
      ],
    );

    await client.query("COMMIT");
    transactionStarted = false;

    /* --------------------------------------------------------
       PROJECT ACTIVITY
    -------------------------------------------------------- */

    try {
      await logProjectActivity(
        project.id,
        req.user.id,
        "PROJECT_MEMBER_ADDED",
        `${target.name || "A member"} was added to the project.`,
      );
    } catch (activityError) {
      console.error(
        "Project member activity logging error:",
        activityError.message,
      );
    }

    return res.status(201).json({
      message: `${target.name || "Member"} was added to the project successfully.`,

      project: {
        id: project.id,
        name: project.name,
      },

      workspace: {
        id: project.workspace_id,
        name: project.workspace_name,
        type: project.workspace_type,
      },

      member: {
        ...membership,
        user_id: Number(target.user_id),
        name: target.name,
        email: target.email,
        workspace_role: targetRole,
      },

      notification_created: true,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Add project member rollback error:",
          rollbackError.message,
        );
      }
    }

    console.error("Add project member error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "This person is already a member of the project.",
      });
    }

    if (error.code === "23503") {
      return res.status(404).json({
        error: "The project, workspace, or selected member could not be found.",
      });
    }

    return res.status(500).json({
      error: "Unable to add this member to the project. Please try again.",
    });
  } finally {
    client.release();
  }
});

/* ============================================================
   GET A SINGLE PROJECT
============================================================ */

router.get("/:id", authMiddleware, async (req, res) => {
  const projectId = normalizeProjectId(req.params.id);

  if (projectId === null) {
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

    const hasAccess = await canAccessProject(project, req.user.id);

    if (!hasAccess) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    return res.json(project);
  } catch (error) {
    console.error("Single project fetch error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/* ============================================================
   UPDATE A PROJECT
============================================================ */

/*
 * Workspace project:
 * Only a Team Leader with actual access to the project can update it.
 *
 * Legacy project:
 * Existing project-creator rule.
 */

router.put("/:id", authMiddleware, async (req, res) => {
  const projectId = normalizeProjectId(req.params.id);

  const { name, description } = req.body || {};

  const normalizedName = typeof name === "string" ? name.trim() : "";

  if (projectId === null || !normalizedName) {
    return res.status(400).json({
      error: "A valid project ID and project name are required",
    });
  }

  try {
    const project = await getProjectContext(projectId);

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    if (project.workspace_id !== null) {
      const isTeamLeader = await hasWorkspaceRole(
        project.workspace_id,
        req.user.id,
        ["TEAM_LEADER"],
      );

      if (!isTeamLeader) {
        return res.status(403).json({
          error: "Only the Workspace Team Leader can update this project",
        });
      }

      if (normalizeRole(project.workspace_type) === "COMPANY") {
        const canManageProject = await canAccessProject(project, req.user.id);

        if (!canManageProject) {
          return res.status(403).json({
            error:
              "You can only update a Company project assigned to you or attached to a team you lead.",
          });
        }
      }
    } else {
      if (!sameId(project.created_by, req.user.id)) {
        return res.status(403).json({
          error: "Only the project creator can update this project",
        });
      }
    }

    const result = await pool.query(
      `
        UPDATE projects

        SET
          name = $1,
          description = $2

        WHERE id = $3

        RETURNING *
      `,
      [
        normalizedName,

        typeof description === "string" && description.trim()
          ? description.trim()
          : null,

        projectId,
      ],
    );

    const updatedProject = result.rows[0];

    try {
      await logProjectActivity(
        updatedProject.id,
        req.user.id,
        "PROJECT_UPDATED",
        `Project "${updatedProject.name}" was updated`,
      );
    } catch (activityError) {
      console.error(
        "Project update activity logging error:",
        activityError.message,
      );
    }

    return res.json(updatedProject);
  } catch (error) {
    console.error("Project update error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/* ============================================================
   DELETE A PROJECT
============================================================ */

/*
 * Workspace project:
 * Only a Team Leader with actual access to the project can delete it.
 *
 * Legacy project:
 * Existing project-creator rule.
 */

router.delete("/:id", authMiddleware, async (req, res) => {
  const projectId = normalizeProjectId(req.params.id);

  if (projectId === null) {
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

    if (project.workspace_id !== null) {
      const isTeamLeader = await hasWorkspaceRole(
        project.workspace_id,
        req.user.id,
        ["TEAM_LEADER"],
      );

      if (!isTeamLeader) {
        return res.status(403).json({
          error: "Only the Workspace Team Leader can delete this project",
        });
      }

      if (normalizeRole(project.workspace_type) === "COMPANY") {
        const canManageProject = await canAccessProject(project, req.user.id);

        if (!canManageProject) {
          return res.status(403).json({
            error:
              "You can only delete a Company project assigned to you or attached to a team you lead.",
          });
        }
      }
    } else {
      if (!sameId(project.created_by, req.user.id)) {
        return res.status(403).json({
          error: "Only the project creator can delete this project",
        });
      }
    }

    const result = await pool.query(
      `
        DELETE FROM projects

        WHERE id = $1

        RETURNING *
      `,
      [projectId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    return res.json({
      message: "Project deleted successfully",
      project: result.rows[0],
    });
  } catch (error) {
    console.error("Project deletion error:", error.message);

    if (error.code === "23503") {
      return res.status(409).json({
        error:
          "This project still has dependent records and cannot be deleted.",
      });
    }

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/* ============================================================
   EXPORT ROUTER
============================================================ */

module.exports = router;
