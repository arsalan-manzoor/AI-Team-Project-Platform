const pool = require("../config/db");

const SUPPORTED_WORKSPACE_TYPES = ["PROJECT", "COMPANY", "INDIVIDUAL"];

const PROJECT_MANAGEMENT_ROLES = ["TEAM_LEADER", "ADMIN", "HR"];

async function getProjectListContext(userId) {
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

            /* ================================================
               EXPLICIT TEAM MEMBERSHIP
            ================================================ */

            EXISTS (
                SELECT 1
                FROM team_members tm
                WHERE tm.team_id = p.team_id
                  AND tm.user_id = $1
            )

            OR

            /* ================================================
               EXPLICIT PROJECT MEMBERSHIP
            ================================================ */

            EXISTS (
                SELECT 1
                FROM project_members pm
                WHERE pm.project_id = p.id
                  AND pm.user_id = $1
            )

            OR

            /* ================================================
               WORKSPACE ROLE VISIBILITY
            ================================================ */

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

                        /* ====================================
                           ADMIN
                        ==================================== */

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

                        /* ====================================
                           COMPANY WORKSPACE RULES
                        ==================================== */

                        (
                            UPPER(
                                TRIM(role_workspace.type::TEXT)
                            ) = 'COMPANY'

                            AND (

                                /* --------------------------------
                                   HR VISIBILITY
                                -------------------------------- */

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

                                        /* HR-assigned projects */
                                        p.assigned_hr_user_id = $1

                                        OR

                                        /* Projects created by HR */
                                        p.created_by = $1

                                        OR

                                        /* Projects under assigned Team Leaders */
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

                                /* --------------------------------
                                   TEAM LEADER VISIBILITY
                                -------------------------------- */

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

                        /* ====================================
                           OTHER WORKSPACE TYPES
                        ==================================== */

                        (
                            UPPER(
                                TRIM(role_workspace.type::TEXT)
                            ) <> 'COMPANY'

                            AND (

                                /* Existing team-based management */
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

                                /* Independent Team Leader access */
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
    [userId, SUPPORTED_WORKSPACE_TYPES, PROJECT_MANAGEMENT_ROLES],
  );

  return {
    projects: result.rows,
  };
}

module.exports = {
  getProjectListContext,
};
