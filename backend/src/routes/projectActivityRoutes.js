const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/*
  GET PROJECT ACTIVITY
  GET /api/project-activities/project/:projectId

  Only users who are members of the project's team
  can view its activity.
*/

router.get("/project/:projectId", authMiddleware, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `
      SELECT
        pa.id,
        pa.project_id,
        pa.user_id,
        u.name AS user_name,
        pa.action,
        pa.description,
        pa.created_at
      FROM project_activities pa
      JOIN users u
        ON u.id = pa.user_id
      JOIN projects p
        ON p.id = pa.project_id
      JOIN teams t
        ON t.id = p.team_id
      JOIN team_members tm
        ON tm.team_id = t.id
       AND tm.user_id = $1
      WHERE pa.project_id = $2
      ORDER BY pa.created_at DESC, pa.id DESC
      LIMIT 20
      `,
      [userId, projectId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get project activity error:", error);
    res.status(500).json({ error: "Failed to fetch project activity" });
  }
});

module.exports = router;
