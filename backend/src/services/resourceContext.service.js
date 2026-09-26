const pool = require("../config/db");
const {
    buildAIContextContract
} = require("./aiContext.contract");

async function getResourceContext(resourceId, userId) {
    const result = await pool.query(
        `SELECT
            resources.id,
            resources.name,
            resources.description,
            resources.url,
            resources.project_id,
            resources.uploaded_by,
            resources.created_at
         FROM resources
         JOIN projects
            ON resources.project_id = projects.id
         JOIN team_members
            ON projects.team_id = team_members.team_id
         WHERE resources.id = $1
           AND team_members.user_id = $2`,
        [resourceId, userId]
    );

    if (result.rows.length === 0) {
        return buildAIContextContract(
            "resource",
            null
        );
    }

    return buildAIContextContract(
        "resource",
        {
            resource: result.rows[0]
        }
    );
}

module.exports = {
    getResourceContext
};