const pool = require("../config/db");

async function getRecentActivityContext(projectId, userId) {
    const accessResult = await pool.query(
        `SELECT projects.id
         FROM projects
         JOIN team_members
            ON projects.team_id = team_members.team_id
         WHERE projects.id = $1
           AND team_members.user_id = $2`,
        [projectId, userId]
    );

    if (accessResult.rows.length === 0) {
        return null;
    }

    const result = await pool.query(
        `SELECT *
         FROM (
             SELECT
                 'task_created' AS type,
                 tasks.id,
                 tasks.title,
                 tasks.created_by AS user_id,
                 NULL::text AS user_name,
                 NULL::text AS content,
                 NULL::integer AS task_id,
                 tasks.created_at
             FROM tasks
             WHERE tasks.project_id = $1

             UNION ALL

             SELECT
                 'milestone_created' AS type,
                 milestones.id,
                 milestones.name AS title,
                 NULL::integer AS user_id,
                 NULL::text AS user_name,
                 NULL::text AS content,
                 NULL::integer AS task_id,
                 milestones.created_at
             FROM milestones
             WHERE milestones.project_id = $1

             UNION ALL

             SELECT
                 'comment_created' AS type,
                 comments.id,
                 NULL::text AS title,
                 comments.user_id,
                 users.name AS user_name,
                 comments.content,
                 comments.task_id,
                 comments.created_at
             FROM comments
             JOIN users
                ON comments.user_id = users.id
             WHERE comments.project_id = $1
                OR comments.task_id IN (
                    SELECT id
                    FROM tasks
                    WHERE project_id = $1
                )
         ) AS activity
         ORDER BY created_at DESC`,
        [projectId]
    );

    return {
        scope: {
            project_id: projectId
        },
        recent_activity: result.rows
    };
}

module.exports = {
    getRecentActivityContext
};