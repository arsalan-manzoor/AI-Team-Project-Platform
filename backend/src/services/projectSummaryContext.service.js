const pool = require("../config/db");
const {
    buildAIContextContract
} = require("./aiContext.contract");

async function getProjectSummaryContext(
    projectId,
    userId
) {
    const projectResult = await pool.query(
        `SELECT
            projects.id,
            projects.name,
            projects.description,
            projects.team_id,
            projects.created_by,
            projects.created_at
         FROM projects
         JOIN team_members
            ON projects.team_id = team_members.team_id
         WHERE projects.id = $1
           AND team_members.user_id = $2`,
        [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
        return buildAIContextContract(
            "project_summary",
            null
        );
    }

    const tasksResult = await pool.query(
        `SELECT
            id,
            title,
            status,
            priority,
            deadline,
            assigned_to
         FROM tasks
         WHERE project_id = $1
         ORDER BY deadline ASC NULLS LAST`,
        [projectId]
    );

    const milestonesResult = await pool.query(
        `SELECT
            id,
            name,
            status,
            deadline
         FROM milestones
         WHERE project_id = $1
         ORDER BY deadline ASC NULLS LAST`,
        [projectId]
    );

    return buildAIContextContract(
        "project_summary",
        {
            project: projectResult.rows[0],
            tasks: tasksResult.rows,
            milestones: milestonesResult.rows
        }
    );
}

module.exports = {
    getProjectSummaryContext
};