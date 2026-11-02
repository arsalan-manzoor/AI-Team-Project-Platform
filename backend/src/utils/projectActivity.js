const pool = require("../config/db");

/**
 * Create a project activity record.
 *
 * @param {number} projectId
 * @param {number} userId
 * @param {string} action
 * @param {string} description
 */
const logProjectActivity = async (projectId, userId, action, description) => {
  try {
    await pool.query(
      `INSERT INTO project_activities
        (project_id, user_id, action, description)
       VALUES ($1, $2, $3, $4)`,
      [projectId, userId, action, description],
    );
  } catch (error) {
    // Activity logging should never break the main operation.
    console.error("Project activity logging error:", error.message);
  }
};

module.exports = {
  logProjectActivity,
};
