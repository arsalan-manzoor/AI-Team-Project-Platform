const bcrypt = require("bcrypt");
const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const { sendVerificationEmail } = require("../utils/emailService");

const router = express.Router();

router.use(express.json());

const ALLOWED_ROLES = ["ADMIN", "HR", "TEAM_LEADER", "USER"];

/*

* Get all users
  */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, created_at FROM users",
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Database error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

/*

* Create a company employee ZYRA account.
*
* This is separate from public signup.
*
* Permission hierarchy:
*
* ADMIN
* -> HR
* -> TEAM_LEADER
* -> USER
*
* HR
* -> TEAM_LEADER
* -> USER
*
* TEAM_LEADER
* -> USER
*
* USER
* -> nothing
*
* This route creates the ZYRA account only.
* Company/workspace membership is handled through
* the company invitation flow.
  */
router.post("/company-account", authMiddleware, async (req, res) => {
  const { name, email, password, role, workspaceId } = req.body;

  if (!name || !email || !password || !role || !workspaceId) {
    return res.status(400).json({
      error: "Name, email, password, role and workspace ID are required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const normalizedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPassword = String(password);
    const normalizedRole = String(role).trim().toUpperCase();
    const normalizedWorkspaceId = Number(workspaceId);

    if (normalizedName.length < 2) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Please enter the employee's real full name",
      });
    }

    if (normalizedPassword.length < 6) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    if (!ALLOWED_ROLES.includes(normalizedRole)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Invalid account role",
      });
    }

    if (
      !Number.isInteger(normalizedWorkspaceId) ||
      normalizedWorkspaceId <= 0
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Invalid workspace ID",
      });
    }

    /*
     * Determine the creator's actual role from
     * workspace_members.
     *
     * users.role is intentionally NOT used as the
     * company permission source.
     */
    const creatorResult = await client.query(
      `
  SELECT
    workspace_members.role AS creator_role,
    workspaces.id AS workspace_id,
    workspaces.type AS workspace_type,
    workspaces.organization_id,
    organizations.verification_status AS organization_status
  FROM workspace_members
  JOIN workspaces
    ON workspace_members.workspace_id = workspaces.id
  LEFT JOIN organizations
    ON workspaces.organization_id = organizations.id
  WHERE workspace_members.workspace_id = $1
    AND workspace_members.user_id = $2
  LIMIT 1
  `,
      [normalizedWorkspaceId, req.user.id],
    );

    if (creatorResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: "You are not a member of this workspace",
      });
    }

    const creator = creatorResult.rows[0];

    /*
     * Employee accounts can only be created
     * inside a COMPANY workspace.
     */
    if (creator.workspace_type !== "COMPANY") {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: "Employee accounts can only be created from a company workspace",
      });
    }

    /*
     * The organization must be verified.
     */
    if (creator.organization_status !== "VERIFIED") {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error:
          "The company must be verified before employee accounts can be created",
      });
    }

    const creatorRole = creator.creator_role;

    /*
     * Define the exact account-creation hierarchy.
     */
    const allowedRolesByCreator = {
      ADMIN: ["HR", "TEAM_LEADER", "USER"],
      HR: ["TEAM_LEADER", "USER"],
      TEAM_LEADER: ["USER"],
      USER: [],
    };

    const allowedRoles = allowedRolesByCreator[creatorRole] || [];

    if (!allowedRoles.includes(normalizedRole)) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: `${creatorRole} cannot create a ${normalizedRole} account`,
      });
    }

    /*
     * An email can belong to only one ZYRA account.
     */
    const existingUserResult = await client.query(
      `
  SELECT
    id,
    name,
    email,
    role,
    account_status
  FROM users
  WHERE LOWER(email) = $1
  LIMIT 1
  `,
      [normalizedEmail],
    );

    if (existingUserResult.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "A ZYRA account with this email already exists",
      });
    }

    /*
     * Remove any old public-signup verification
     * for this email.
     */
    await client.query(
      `
  DELETE FROM email_verifications
  WHERE LOWER(email) = $1
  `,
      [normalizedEmail],
    );

    /*
     * Hash the employee's initial password.
     */
    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    /*
     * Create the employee account.
     *
     * account_status is ACTIVE so the employee can
     * immediately log in using the credentials supplied
     * by the administrator/HR/team leader.
     *
     * Company membership is NOT created here.
     */
    const userResult = await client.query(
      `
  INSERT INTO users
    (name, email, password, role, account_status)
  VALUES
    ($1, $2, $3, $4, 'ACTIVE')
  RETURNING
    id,
    name,
    email,
    role,
    account_status,
    created_at
  `,
      [normalizedName, normalizedEmail, hashedPassword, normalizedRole],
    );

    await client.query("COMMIT");

    /*
     * Return the initial credentials so the creator
     * can securely provide them to the employee.
     *
     * The password is never stored in plaintext.
     */
    res.status(201).json({
      message: "Employee ZYRA account created successfully",

      account: userResult.rows[0],

      credentials: {
        email: normalizedEmail,
        password: normalizedPassword,
      },

      next_step:
        "Create a company invitation for this employee so they can accept membership after logging in.",
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Company employee account creation error:", error.message);

    res.status(500).json({
      error: "Unable to create employee account. Please try again.",
    });
  } finally {
    client.release();
  }
});

/*

* Create a new user / Start public signup
*
* This existing public signup flow is preserved.
  */
router.post("/", async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({
      error: "Name, email, password and role are required",
    });
  }

  try {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.trim().toUpperCase();

    if (normalizedName.length < 2) {
      return res.status(400).json({
        error: "Please enter your real full name",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    if (!ALLOWED_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        error: "Invalid account role",
      });
    }

    /*
     * Check whether this exact email + role account already exists.
     */
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1 AND role = $2",
      [normalizedEmail, normalizedRole],
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: "An account with this email and role already exists",
      });
    }

    /*
     * Remove any previous pending verification
     * for this email + role.
     */
    await pool.query(
      "DELETE FROM email_verifications WHERE email = $1 AND role = $2",
      [normalizedEmail, normalizedRole],
    );

    /*
     * Hash the ZYRA password before storing it temporarily.
     */
    const hashedPassword = await bcrypt.hash(password, 10);

    /*
     * Generate a 6-digit verification code.
     */
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    /*
     * Code expires in 10 minutes.
     */
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO email_verifications
         (name, email, password, role, verification_code, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        normalizedName,
        normalizedEmail,
        hashedPassword,
        normalizedRole,
        verificationCode,
        expiresAt,
      ],
    );

    /*
     * Send verification email.
     */
    await sendVerificationEmail(
      normalizedEmail,
      normalizedName,
      verificationCode,
    );

    res.status(201).json({
      message: "Verification code sent to your email",
      email: normalizedEmail,
      role: normalizedRole,
    });
  } catch (error) {
    console.error("Signup error:", error.message);

    res.status(500).json({
      error: "Unable to start signup. Please try again.",
    });
  }
});

/*

* Verify email and create public signup account
  */
router.post("/verify", async (req, res) => {
  const { email, verificationCode } = req.body;

  if (!email || !verificationCode) {
    return res.status(400).json({
      error: "Email and verification code are required",
    });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = verificationCode.trim();

    const verificationResult = await pool.query(
      `SELECT *
         FROM email_verifications
         WHERE email = $1
         ORDER BY created_at DESC
         LIMIT 1`,
      [normalizedEmail],
    );

    if (verificationResult.rows.length === 0) {
      return res.status(400).json({
        error: "No pending verification found. Please sign up again.",
      });
    }

    const verification = verificationResult.rows[0];

    /*
     * Check whether the code has expired.
     */
    if (new Date() > new Date(verification.expires_at)) {
      await pool.query("DELETE FROM email_verifications WHERE id = $1", [
        verification.id,
      ]);

      return res.status(400).json({
        error: "Verification code has expired. Please sign up again.",
      });
    }

    /*
     * Check whether the code is correct.
     */
    if (verification.verification_code !== normalizedCode) {
      return res.status(400).json({
        error: "Invalid verification code",
      });
    }

    /*
     * Make sure this exact email + role account wasn't
     * registered while verification was pending.
     */
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1 AND role = $2",
      [normalizedEmail, verification.role],
    );

    if (existingUser.rows.length > 0) {
      await pool.query("DELETE FROM email_verifications WHERE id = $1", [
        verification.id,
      ]);

      return res.status(409).json({
        error: "An account with this email and role already exists",
      });
    }

    /*
     * Create the real user account.
     */
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, role, created_at`,
      [
        verification.name,
        verification.email,
        verification.password,
        verification.role,
      ],
    );

    /*
     * Verification completed, so remove the temporary record.
     */
    await pool.query("DELETE FROM email_verifications WHERE id = $1", [
      verification.id,
    ]);

    res.status(201).json({
      message: "Email verified and account created successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Email verification error:", error.message);

    res.status(500).json({
      error: "Unable to verify email. Please try again.",
    });
  }
});

/*

* Update logged-in user's profile
  */
router.put("/:id", authMiddleware, async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      error: "Name and email are required",
    });
  }

  try {
    if (req.user.id !== Number(req.params.id)) {
      return res.status(403).json({
        error: "You can only update your own profile",
      });
    }

    let result;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);

      result = await pool.query(
        `UPDATE users
             SET name = $1, email = $2, password = $3
             WHERE id = $4
             RETURNING id, name, email, role, created_at`,
        [name, email, hashedPassword, req.user.id],
      );
    } else {
      result = await pool.query(
        `UPDATE users
             SET name = $1, email = $2
             WHERE id = $3
             RETURNING id, name, email, role, created_at`,
        [name, email, req.user.id],
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json({
      message: "Profile updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Profile update error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

module.exports = router;
