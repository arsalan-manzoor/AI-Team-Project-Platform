const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Get Organization Analytics
|--------------------------------------------------------------------------
|
| ADMIN / HR
|
| Analytics included:
| - Organization members
| - Departments
| - Teams
| - Projects
| - Tasks
| - Tasks grouped by status
| - Recent project activity
|
| Organization access is verified through:
|
| workspace_members
|       ↓
| workspaces
|       ↓
| organizations
|
| We do NOT use users.role.
|
|--------------------------------------------------------------------------
*/

router.get(
  "/organization/:organizationId",
  authMiddleware,
  async (req, res) => {
    const { organizationId } = req.params;

    if (!organizationId || !Number.isInteger(Number(organizationId))) {
      return res.status(400).json({
        error: "Valid organization ID is required",
      });
    }

    const numericOrganizationId = Number(organizationId);

    try {
      /*
      |--------------------------------------------------------------------------
      | Verify organization + requester authorization
      |--------------------------------------------------------------------------
      */

      const authorizationResult = await pool.query(
        `
        SELECT
          organizations.id,
          organizations.organization_id AS public_organization_id,
          organizations.name,
          organizations.type,
          organizations.verification_status,
          workspace_members.role,
          workspaces.id AS workspace_id,
          workspaces.name AS workspace_name
        FROM workspace_members
        JOIN workspaces
          ON workspace_members.workspace_id = workspaces.id
        JOIN organizations
          ON workspaces.organization_id = organizations.id
        WHERE workspace_members.user_id = $1
          AND organizations.id = $2
          AND workspaces.type = 'COMPANY'
          AND workspace_members.role IN ('ADMIN', 'HR')
          AND organizations.verification_status = 'VERIFIED'
        LIMIT 1
        `,
        [req.user.id, numericOrganizationId],
      );

      if (authorizationResult.rows.length === 0) {
        return res.status(403).json({
          error:
            "Only verified organization ADMIN or HR members can view organization analytics",
        });
      }

      const organization = authorizationResult.rows[0];

      /*
      |--------------------------------------------------------------------------
      | Organization Members
      |--------------------------------------------------------------------------
      */

      const membersResult = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM organization_members
        WHERE organization_id = $1
        `,
        [numericOrganizationId],
      );

      /*
      |--------------------------------------------------------------------------
      | Departments
      |--------------------------------------------------------------------------
      */

      const departmentsResult = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM departments
        WHERE organization_id = $1
        `,
        [numericOrganizationId],
      );

      /*
      |--------------------------------------------------------------------------
      | Teams
      |--------------------------------------------------------------------------
      |
      | Teams are connected to the organization through their workspace.
      |
      */

      const teamsResult = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM teams
        JOIN workspaces
          ON teams.workspace_id = workspaces.id
        WHERE workspaces.organization_id = $1
          AND workspaces.type = 'COMPANY'
        `,
        [numericOrganizationId],
      );

      /*
      |--------------------------------------------------------------------------
      | Projects
      |--------------------------------------------------------------------------
      |
      | Projects → Teams → Workspace → Organization
      |
      */

      const projectsResult = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM projects
        JOIN teams
          ON projects.team_id = teams.id
        JOIN workspaces
          ON teams.workspace_id = workspaces.id
        WHERE workspaces.organization_id = $1
          AND workspaces.type = 'COMPANY'
        `,
        [numericOrganizationId],
      );

      /*
      |--------------------------------------------------------------------------
      | Tasks
      |--------------------------------------------------------------------------
      |
      | Tasks → Projects → Teams → Workspace → Organization
      |
      */

      const tasksResult = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM tasks
        JOIN projects
          ON tasks.project_id = projects.id
        JOIN teams
          ON projects.team_id = teams.id
        JOIN workspaces
          ON teams.workspace_id = workspaces.id
        WHERE workspaces.organization_id = $1
          AND workspaces.type = 'COMPANY'
        `,
        [numericOrganizationId],
      );

      /*
      |--------------------------------------------------------------------------
      | Tasks By Status
      |--------------------------------------------------------------------------
      */

      const taskStatusResult = await pool.query(
        `
        SELECT
          tasks.status,
          COUNT(*) AS count
        FROM tasks
        JOIN projects
          ON tasks.project_id = projects.id
        JOIN teams
          ON projects.team_id = teams.id
        JOIN workspaces
          ON teams.workspace_id = workspaces.id
        WHERE workspaces.organization_id = $1
          AND workspaces.type = 'COMPANY'
        GROUP BY tasks.status
        ORDER BY tasks.status ASC
        `,
        [numericOrganizationId],
      );

      /*
      |--------------------------------------------------------------------------
      | Recent Project Activity
      |--------------------------------------------------------------------------
      |
      | Activity is connected to the organization through:
      |
      | project_activities
      |       ↓
      | projects
      |       ↓
      | teams
      |       ↓
      | workspaces
      |       ↓
      | organizations
      |
      */

      const activityResult = await pool.query(
        `
        SELECT
          project_activities.id,
          project_activities.project_id,
          project_activities.user_id,
          users.name AS user_name,
          projects.name AS project_name,
          project_activities.action,
          project_activities.description,
          project_activities.created_at
        FROM project_activities
        JOIN users
          ON project_activities.user_id = users.id
        JOIN projects
          ON project_activities.project_id = projects.id
        JOIN teams
          ON projects.team_id = teams.id
        JOIN workspaces
          ON teams.workspace_id = workspaces.id
        WHERE workspaces.organization_id = $1
          AND workspaces.type = 'COMPANY'
        ORDER BY project_activities.created_at DESC,
                 project_activities.id DESC
        LIMIT 10
        `,
        [numericOrganizationId],
      );

      /*
      |--------------------------------------------------------------------------
      | Response
      |--------------------------------------------------------------------------
      */

      return res.status(200).json({
        organization: {
          id: organization.id,
          organization_id: organization.public_organization_id,
          name: organization.name,
          type: organization.type,
          verification_status: organization.verification_status,
        },

        workspace: {
          id: organization.workspace_id,
          name: organization.workspace_name,
          type: "COMPANY",
        },

        analytics: {
          members: Number(membersResult.rows[0].total),
          departments: Number(departmentsResult.rows[0].total),
          teams: Number(teamsResult.rows[0].total),
          projects: Number(projectsResult.rows[0].total),
          tasks: Number(tasksResult.rows[0].total),

          tasks_by_status: taskStatusResult.rows.map((row) => ({
            status: row.status,
            count: Number(row.count),
          })),

          recent_activity: activityResult.rows,
        },
      });
    } catch (error) {
      console.error("Organization analytics error:", error.message);

      return res.status(500).json({
        error: "Unable to fetch organization analytics",
      });
    }
  },
);

module.exports = router;
