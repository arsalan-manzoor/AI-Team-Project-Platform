const pool = require("../config/db");

async function getNotificationContext(userId) {
    const result = await pool.query(
        `SELECT id,
                user_id,
                title,
                message,
                is_read,
                created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
    );

    return {
        notifications: result.rows
    };
}

module.exports = {
    getNotificationContext
};