const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Create a department
router.post("/", authMiddleware, async (req, res) => {
  const { organizationId, name, description } = req.body;

  if (!organizationId) {
    return res.status(400).json({
      error: "Organization ID is required",
    });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({
      error: "Department name is required",
    });
  }

  try {
    // Verify that the user is an ADMIN or HR
    // of a workspace belonging to this organization.
    const authorizationResult = await pool.query(
      `SELECT workspace_members.role
       FROM workspace_members
       JOIN workspaces
         ON workspace_members.workspace_id = workspaces.id
       WHERE workspace_members.user_id = $1
         AND workspaces.organization_id = $2
         AND workspaces.type = 'COMPANY'
         AND workspace_members.role IN ('ADMIN', 'HR')
       LIMIT 1`,
      [req.user.id, organizationId],
    );

    if (authorizationResult.rows.length === 0) {
      return res.status(403).json({
        error: "Only organization ADMIN or HR can create departments",
      });
    }

    // Verify organization exists and is verified.
    const organizationResult = await pool.query(
      `SELECT id,
              name,
              verification_status
       FROM organizations
       WHERE id = $1`,
      [organizationId],
    );

    if (organizationResult.rows.length === 0) {
      return res.status(404).json({
        error: "Organization not found",
      });
    }

    if (organizationResult.rows[0].verification_status !== "VERIFIED") {
      return res.status(403).json({
        error: "Organization is not verified",
      });
    }

    const result = await pool.query(
      `INSERT INTO departments
       (organization_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        organizationId,
        name.trim(),
        description ? description.trim() : null,
        req.user.id,
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Department creation error:", error.message);

    if (error.code === "23503") {
      return res.status(404).json({
        error: "Organization or user not found",
      });
    }

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Get departments of an organization
router.get("/organization/:organizationId", authMiddleware, async (req, res) => {
  const { organizationId } = req.params;

  try {
    // Verify that the user belongs to the organization
    // through a company workspace.
    const accessResult = await pool.query(
      `SELECT workspace_members.role
       FROM workspace_members
       JOIN workspaces
         ON workspace_members.workspace_id = workspaces.id
       WHERE workspace_members.user_id = $1
         AND workspaces.organization_id = $2
         AND workspaces.type = 'COMPANY'
       LIMIT 1`,
      [req.user.id, organizationId],
    );

    if (accessResult.rows.length === 0) {
      return res.status(403).json({
        error: "You do not have access to this organization",
      });
    }

    const result = await pool.query(
      `SELECT departments.id,
              departments.organization_id,
              departments.name,
              departments.description,
              departments.created_by,
              departments.created_at,
              users.name AS created_by_name
       FROM departments
       JOIN users
         ON departments.created_by = users.id
       WHERE departments.organization_id = $1
       ORDER BY departments.created_at DESC`,
      [organizationId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Department fetch error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Update a department
router.put("/:departmentId", authMiddleware, async (req, res) => {
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      error: "Department name is required",
    });
  }

  try {
    // Find department and its organization.
    const departmentResult = await pool.query(
      `SELECT id,
              organization_id
       FROM departments
       WHERE id = $1`,
      [req.params.departmentId],
    );

    if (departmentResult.rows.length === 0) {
      return res.status(404).json({
        error: "Department not found",
      });
    }

    const department = departmentResult.rows[0];

    // Verify ADMIN or HR authorization.
    const authorizationResult = await pool.query(
      `SELECT workspace_members.role
       FROM workspace_members
       JOIN workspaces
         ON workspace_members.workspace_id = workspaces.id
       WHERE workspace_members.user_id = $1
         AND workspaces.organization_id = $2
         AND workspaces.type = 'COMPANY'
         AND workspace_members.role IN ('ADMIN', 'HR')
       LIMIT 1`,
      [req.user.id, department.organization_id],
    );

    if (authorizationResult.rows.length === 0) {
      return res.status(403).json({
        error: "Only organization ADMIN or HR can update departments",
      });
    }

    const result = await pool.query(
      `UPDATE departments
       SET name = $1,
           description = $2
       WHERE id = $3
       RETURNING *`,
      [
        name.trim(),
        description ? description.trim() : null,
        req.params.departmentId,
      ],
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Department update error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Delete a department
router.delete("/:departmentId", authMiddleware, async (req, res) => {
  try {
    // Find department and its organization.
    const departmentResult = await pool.query(
      `SELECT id,
              organization_id
       FROM departments
       WHERE id = $1`,
      [req.params.departmentId],
    );

    if (departmentResult.rows.length === 0) {
      return res.status(404).json({
        error: "Department not found",
      });
    }

    const department = departmentResult.rows[0];

    // Verify ADMIN or HR authorization.
    const authorizationResult = await pool.query(
      `SELECT workspace_members.role
       FROM workspace_members
       JOIN workspaces
         ON workspace_members.workspace_id = workspaces.id
       WHERE workspace_members.user_id = $1
         AND workspaces.organization_id = $2
         AND workspaces.type = 'COMPANY'
         AND workspace_members.role IN ('ADMIN', 'HR')
       LIMIT 1`,
      [req.user.id, department.organization_id],
    );

    if (authorizationResult.rows.length === 0) {
      return res.status(403).json({
        error: "Only organization ADMIN or HR can delete departments",
      });
    }

    const result = await pool.query(
      `DELETE FROM departments
       WHERE id = $1
       RETURNING *`,
      [req.params.departmentId],
    );

    res.json({
      message: "Department deleted successfully",
      department: result.rows[0],
    });
  } catch (error) {
    console.error("Department deletion error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

module.exports = router;