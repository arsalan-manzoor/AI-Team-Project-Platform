const bcrypt = require("bcrypt");
const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const { sendVerificationEmail } = require("../utils/emailService");

const router = express.Router();

router.use(express.json());

const ALLOWED_ROLES = ["ADMIN", "HR", "TEAM_LEADER", "USER"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cryptoSafeSixDigitCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function createCompanySignupOrganizationId() {
  return `ZYRA-ORG-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function normalizeCompanySignupDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/\.$/, "");
}

/*
 * =========================================================
 * GET ALL USERS
 * =========================================================
 */

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        email,
        role,
        created_at
      FROM users
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error("Database error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

/*
 * =========================================================
 * CREATE COMPANY EMPLOYEE ACCOUNT
 * =========================================================
 */

router.post("/company-account", authMiddleware, async (req, res) => {
  const { name, email, password, role, workspaceId } = req.body || {};

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

    const creatorResult = await client.query(
      `
      SELECT
        workspace_members.role AS creator_role,
        workspaces.id AS workspace_id,
        workspaces.name AS workspace_name,
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

    if (creator.workspace_type !== "COMPANY") {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: "Employee accounts can only be created from a company workspace",
      });
    }

    if (creator.organization_status !== "VERIFIED") {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error:
          "The company must be verified before employee accounts can be created",
      });
    }

    const allowedRolesByCreator = {
      ADMIN: ["HR", "TEAM_LEADER", "USER"],
      HR: ["TEAM_LEADER", "USER"],
      TEAM_LEADER: ["USER"],
      USER: [],
    };

    const allowedRoles = allowedRolesByCreator[creator.creator_role] || [];

    if (!allowedRoles.includes(normalizedRole)) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: `${creator.creator_role} cannot create a ${normalizedRole} account`,
      });
    }

    const existingUserResult = await client.query(
      `
      SELECT id
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

    await client.query(
      `
      DELETE FROM email_verifications
      WHERE LOWER(email) = $1
      `,
      [normalizedEmail],
    );

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    const userResult = await client.query(
      `
      INSERT INTO users
      (
        name,
        email,
        password,
        role,
        account_status,
        must_change_password
      )
      VALUES
      ($1, $2, $3, $4, 'ACTIVE', TRUE)
      RETURNING
        id,
        name,
        email,
        role,
        account_status,
        must_change_password,
        created_at
      `,
      [normalizedName, normalizedEmail, hashedPassword, normalizedRole],
    );

    const newUser = userResult.rows[0];

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Employee ZYRA account created successfully",
      account: newUser,
      credentials: {
        email: normalizedEmail,
        password: normalizedPassword,
      },
      must_change_password: true,
      next_step:
        "Create a company invitation for this employee so they can accept membership after logging in.",
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Company account rollback error:", rollbackError.message);
    }

    console.error("Company employee account creation error:", error.message);

    return res.status(500).json({
      error: "Unable to create employee account. Please try again.",
    });
  } finally {
    client.release();
  }
});

/*
 * =========================================================
 * CREATE INDIVIDUAL WORKSPACE MEMBER ACCOUNT
 * =========================================================
 */

router.post("/individual-account", authMiddleware, async (req, res) => {
  const { name, email, password, role, workspaceId } = req.body || {};

  if (!name || !email || !password || !role || !workspaceId) {
    return res.status(400).json({
      error: "Name, email, password, role and workspace ID are required",
    });
  }

  const normalizedName = String(name).trim();
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedPassword = String(password);
  const normalizedRole = String(role).trim().toUpperCase();
  const normalizedWorkspaceId = Number(workspaceId);

  if (normalizedName.length < 2) {
    return res.status(400).json({
      error: "Please enter the member's full name",
    });
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return res.status(400).json({
      error: "Please enter a valid email address",
    });
  }

  if (normalizedPassword.length < 8) {
    return res.status(400).json({
      error: "The initial password must contain at least 8 characters",
    });
  }

  if (Buffer.byteLength(normalizedPassword, "utf8") > 72) {
    return res.status(400).json({
      error: "The password must not exceed 72 bytes",
    });
  }

  if (!["TEAM_LEADER", "USER"].includes(normalizedRole)) {
    return res.status(400).json({
      error: "An Individual Team Leader can assign TEAM_LEADER or USER only",
    });
  }

  if (!Number.isInteger(normalizedWorkspaceId) || normalizedWorkspaceId <= 0) {
    return res.status(400).json({
      error: "A valid Individual workspace ID is required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const creatorResult = await client.query(
      `
      SELECT
        wm.role AS creator_role,
        w.id AS workspace_id,
        w.name AS workspace_name,
        w.type AS workspace_type
      FROM workspace_members wm
      JOIN workspaces w
        ON w.id = wm.workspace_id
      WHERE wm.workspace_id = $1
        AND wm.user_id = $2
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

    if (creator.workspace_type !== "INDIVIDUAL") {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: "This endpoint can only be used from an Individual workspace",
      });
    }

    if (creator.creator_role !== "TEAM_LEADER") {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: "Only the Individual Team Leader can create member accounts",
      });
    }

    const existingUserResult = await client.query(
      `
      SELECT id
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

    await client.query(
      `
      DELETE FROM email_verifications
      WHERE LOWER(email) = $1
      `,
      [normalizedEmail],
    );

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    const userResult = await client.query(
      `
      INSERT INTO users
      (
        name,
        email,
        password,
        role,
        account_status,
        must_change_password
      )
      VALUES
      ($1, $2, $3, $4, 'ACTIVE', TRUE)
      RETURNING
        id,
        name,
        email,
        role,
        account_status,
        must_change_password,
        created_at
      `,
      [normalizedName, normalizedEmail, hashedPassword, normalizedRole],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Individual member account created successfully",
      account: userResult.rows[0],
      credentials: {
        email: normalizedEmail,
        password: normalizedPassword,
      },
      workspace: {
        id: creator.workspace_id,
        name: creator.workspace_name,
        type: creator.workspace_type,
      },
      membership_created: false,
      next_step:
        "Create an Individual workspace invitation for this account. The member will join only after changing the initial password and accepting the invitation.",
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Individual member account rollback error:",
        rollbackError.message,
      );
    }

    console.error("Individual member account creation error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "An account with this email already exists",
      });
    }

    return res.status(500).json({
      error: "Unable to create Individual member account. Please try again.",
    });
  } finally {
    client.release();
  }
});

/*
 * =========================================================
 * INDIVIDUAL SIGNUP — START EMAIL VERIFICATION
 * =========================================================
 */

router.post("/", async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Name, email and password are required",
    });
  }

  try {
    const normalizedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPassword = String(password);

    if (normalizedName.length < 2) {
      return res.status(400).json({
        error: "Please enter your real full name",
      });
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({
        error: "Please enter a valid email address",
      });
    }

    if (normalizedPassword.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    const existingUser = await pool.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [normalizedEmail],
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error:
          "A ZYRA account with this email already exists. Please sign in instead.",
      });
    }

    await pool.query(
      `
      DELETE FROM email_verifications
      WHERE LOWER(email) = $1
      `,
      [normalizedEmail],
    );

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
    const verificationCode = cryptoSafeSixDigitCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `
      INSERT INTO email_verifications
      (
        name,
        email,
        password,
        role,
        verification_code,
        expires_at
      )
      VALUES
      ($1, $2, $3, $4, $5, $6)
      `,
      [
        normalizedName,
        normalizedEmail,
        hashedPassword,
        "TEAM_LEADER",
        verificationCode,
        expiresAt,
      ],
    );

    await sendVerificationEmail(
      normalizedEmail,
      normalizedName,
      verificationCode,
    );

    return res.status(201).json({
      message: "Verification code sent to your email",
      email: normalizedEmail,
      role: "TEAM_LEADER",
    });
  } catch (error) {
    console.error("Signup error:", error.message);

    return res.status(500).json({
      error: "Unable to start signup. Please try again.",
    });
  }
});

/*
 * =========================================================
 * VERIFY INDIVIDUAL EMAIL AND CREATE WORKSPACE
 * =========================================================
 */

router.post("/verify", async (req, res) => {
  const { email, verificationCode } = req.body || {};

  if (!email || !verificationCode) {
    return res.status(400).json({
      error: "Email and verification code are required",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedCode = String(verificationCode).trim();

  try {
    const verificationResult = await pool.query(
      `
      SELECT *
      FROM email_verifications
      WHERE LOWER(email) = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [normalizedEmail],
    );

    if (verificationResult.rows.length === 0) {
      return res.status(400).json({
        error: "No pending verification found. Please sign up again.",
      });
    }

    const verification = verificationResult.rows[0];

    if (new Date() > new Date(verification.expires_at)) {
      await pool.query(
        `
        DELETE FROM email_verifications
        WHERE email = $1
        `,
        [normalizedEmail],
      );

      return res.status(400).json({
        error: "Verification code has expired. Please sign up again.",
      });
    }

    if (verification.verification_code !== normalizedCode) {
      return res.status(400).json({
        error: "Invalid verification code",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingUser = await client.query(
        `
        SELECT id
        FROM users
        WHERE LOWER(email) = $1
        LIMIT 1
        `,
        [normalizedEmail],
      );

      if (existingUser.rows.length > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          error:
            "A ZYRA account with this email already exists. Please sign in instead.",
        });
      }

      const userResult = await client.query(
        `
        INSERT INTO users
        (name, email, password, role)
        VALUES
        ($1, $2, $3, $4)
        RETURNING
          id,
          name,
          email,
          role,
          created_at,
          account_status
        `,
        [
          verification.name,
          normalizedEmail,
          verification.password,
          "TEAM_LEADER",
        ],
      );

      const newUser = userResult.rows[0];

      const workspaceName = `${newUser.name}'s Individual Workspace`;

      const workspaceResult = await client.query(
        `
        INSERT INTO workspaces
        (name, type, created_by)
        VALUES
        ($1, 'INDIVIDUAL', $2)
        RETURNING
          id,
          name,
          type,
          created_by,
          created_at
        `,
        [workspaceName, newUser.id],
      );

      const workspace = workspaceResult.rows[0];

      const membershipResult = await client.query(
        `
        INSERT INTO workspace_members
        (workspace_id, user_id, role)
        VALUES
        ($1, $2, 'TEAM_LEADER')
        RETURNING
          id,
          workspace_id,
          user_id,
          role,
          joined_at
        `,
        [workspace.id, newUser.id],
      );

      await client.query(
        `
        DELETE FROM email_verifications
        WHERE id = $1
        `,
        [verification.id],
      );

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Email verified and Individual Workspace created successfully",
        user: newUser,
        workspace,
        membership: membershipResult.rows[0],
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Signup transaction rollback error:",
          rollbackError.message,
        );
      }

      console.error(
        "Email verification and Individual Workspace creation error:",
        error.message,
      );

      if (error.code === "23505") {
        return res.status(409).json({
          error:
            "An account or workspace membership already exists. Please sign in.",
        });
      }

      return res.status(500).json({
        error: "Unable to complete signup. Please try again.",
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Email verification error:", error.message);

    return res.status(500).json({
      error: "Unable to verify email. Please try again.",
    });
  }
});

/*
 * =========================================================
 * UPDATE LOGGED-IN USER PROFILE
 * =========================================================
 */

router.put("/:id", authMiddleware, async (req, res) => {
  const userId = Number(req.params.id);
  const authenticatedUserId = Number(req.user.id);
  const body = req.body || {};

  const hasField = (field) => Object.prototype.hasOwnProperty.call(body, field);

  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    authenticatedUserId !== userId
  ) {
    return res.status(403).json({
      error: "You can only update your own profile",
    });
  }

  try {
    const existingResult = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        username,
        mobile_number,
        date_of_birth,
        profile_image_url
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId],
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const existingUser = existingResult.rows[0];

    const name = hasField("name")
      ? String(body.name ?? "").trim()
      : existingUser.name;

    if (!name || name.length < 2 || name.length > 100) {
      return res.status(400).json({
        error: "Name must contain between 2 and 100 characters",
      });
    }

    const email = hasField("email")
      ? String(body.email ?? "")
          .trim()
          .toLowerCase()
      : existingUser.email;

    if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({
        error: "Please enter a valid email address",
      });
    }

    let username = existingUser.username;

    if (hasField("username")) {
      username = String(body.username ?? "")
        .trim()
        .replace(/^@/, "")
        .toLowerCase();

      username = username || null;
    }

    if (
      username !== null &&
      (username.length < 3 ||
        username.length > 30 ||
        !/^[a-z0-9._]+$/.test(username))
    ) {
      return res.status(400).json({
        error:
          "Username must be 3–30 characters and may contain lowercase letters, numbers, periods, and underscores",
      });
    }

    let mobileNumber = existingUser.mobile_number;

    if (hasField("mobile_number")) {
      const suppliedMobile = String(body.mobile_number ?? "").trim();
      mobileNumber = suppliedMobile || null;
    }

    if (
      mobileNumber !== null &&
      (!/^[+0-9() -]+$/.test(mobileNumber) ||
        mobileNumber.replace(/\D/g, "").length < 7 ||
        mobileNumber.replace(/\D/g, "").length > 15 ||
        mobileNumber.length > 20)
    ) {
      return res.status(400).json({
        error: "Please enter a valid mobile number",
      });
    }

    let dateOfBirth = existingUser.date_of_birth
      ? String(existingUser.date_of_birth).slice(0, 10)
      : null;

    if (hasField("date_of_birth")) {
      const suppliedDate = String(body.date_of_birth ?? "").trim();
      dateOfBirth = suppliedDate || null;
    }

    if (dateOfBirth !== null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
        return res.status(400).json({
          error: "Date of birth must use the YYYY-MM-DD format",
        });
      }

      const parsedDate = new Date(`${dateOfBirth}T00:00:00.000Z`);

      if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== dateOfBirth
      ) {
        return res.status(400).json({
          error: "Please enter a valid date of birth",
        });
      }

      const today = new Date().toISOString().slice(0, 10);

      if (dateOfBirth > today) {
        return res.status(400).json({
          error: "Date of birth cannot be in the future",
        });
      }
    }

    let profileImageUrl = existingUser.profile_image_url;

    if (hasField("profile_image_url")) {
      const suppliedImageUrl = String(body.profile_image_url ?? "").trim();
      profileImageUrl = suppliedImageUrl || null;
    }

    if (
      profileImageUrl !== null &&
      (profileImageUrl.length > 2048 ||
        !/^(https?:\/\/|\/)/i.test(profileImageUrl))
    ) {
      return res.status(400).json({
        error: "Please provide a valid profile image URL or server path",
      });
    }

    const emailConflict = await pool.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER($1)
        AND id <> $2
      LIMIT 1
      `,
      [email, userId],
    );

    if (emailConflict.rows.length > 0) {
      return res.status(409).json({
        error: "This email address is already associated with another account",
      });
    }

    if (username !== null) {
      const usernameConflict = await pool.query(
        `
        SELECT id
        FROM users
        WHERE LOWER(username) = LOWER($1)
          AND id <> $2
        LIMIT 1
        `,
        [username, userId],
      );

      if (usernameConflict.rows.length > 0) {
        return res.status(409).json({
          error: "This username is already taken",
        });
      }
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        name = $1,
        email = $2,
        username = $3,
        mobile_number = $4,
        date_of_birth = $5,
        profile_image_url = $6
      WHERE id = $7
      RETURNING
        id,
        name,
        email,
        username,
        mobile_number,
        date_of_birth,
        profile_image_url,
        role,
        created_at
      `,
      [
        name,
        email,
        username,
        mobileNumber,
        dateOfBirth,
        profileImageUrl,
        userId,
      ],
    );

    return res.json({
      message: "Profile updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Profile update error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "That username or email address is already in use",
      });
    }

    return res.status(500).json({
      error: "Unable to update your profile. Please try again.",
    });
  }
});

/*
 * =========================================================
 * PUBLIC COMPANY SIGNUP — START EMAIL VERIFICATION
 * =========================================================
 */

router.post("/company-signup/start", async (req, res) => {
  const {
    companyName,
    companyEmail,
    website,
    industry,
    companySize,
    country,
    domain,
    adminName,
    adminEmail,
    password,
  } = req.body || {};

  const company = String(companyName || "").trim();
  const officialEmail = String(companyEmail || "")
    .trim()
    .toLowerCase();
  const administrator = String(adminName || "").trim();
  const administratorEmail = String(adminEmail || "")
    .trim()
    .toLowerCase();
  const normalizedIndustry = String(industry || "").trim();
  const normalizedSize = String(companySize || "").trim();
  const normalizedCountry = String(country || "").trim();
  const officialDomain = normalizeCompanySignupDomain(domain);
  const rawPassword = String(password || "");

  if (
    !company ||
    !officialEmail ||
    !administrator ||
    !administratorEmail ||
    !normalizedIndustry ||
    !normalizedSize ||
    !normalizedCountry ||
    !officialDomain ||
    !rawPassword
  ) {
    return res.status(400).json({
      error: "Please complete all required Company signup fields.",
    });
  }

  const domainPattern =
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

  if (
    !EMAIL_PATTERN.test(officialEmail) ||
    !EMAIL_PATTERN.test(administratorEmail)
  ) {
    return res.status(400).json({
      error: "Please enter valid email addresses.",
    });
  }

  if (
    company.length > 255 ||
    administrator.length < 2 ||
    administrator.length > 255 ||
    normalizedIndustry.length > 120 ||
    normalizedSize.length > 80 ||
    normalizedCountry.length > 120 ||
    !domainPattern.test(officialDomain)
  ) {
    return res.status(400).json({
      error:
        "Please check the Company name, administrator name, industry, company size, country, or domain.",
    });
  }

  if (rawPassword.length < 8 || Buffer.byteLength(rawPassword, "utf8") > 72) {
    return res.status(400).json({
      error:
        "Password must be at least 8 characters and no more than 72 bytes.",
    });
  }

  const emailDomain = officialEmail.split("@").pop();

  if (
    emailDomain !== officialDomain &&
    !emailDomain.endsWith(`.${officialDomain}`)
  ) {
    return res.status(400).json({
      error:
        "The official Company email must belong to the Company domain you entered.",
    });
  }

  let normalizedWebsite = null;

  if (String(website || "").trim()) {
    try {
      const parsedWebsite = new URL(String(website).trim());

      if (!["http:", "https:"].includes(parsedWebsite.protocol)) {
        throw new Error("Invalid protocol");
      }

      normalizedWebsite = parsedWebsite.toString();
    } catch {
      return res.status(400).json({
        error: "Please enter a valid Company website URL.",
      });
    }
  }

  try {
    const existingAdmin = await pool.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [administratorEmail],
    );

    if (existingAdmin.rows.length) {
      return res.status(409).json({
        error:
          "An account with the administrator email already exists. Please sign in instead.",
      });
    }

    const existingOrganization = await pool.query(
      `
      SELECT id
      FROM organizations
      WHERE LOWER(official_domain) = $1
         OR LOWER(official_email) = $2
      LIMIT 1
      `,
      [officialDomain, officialEmail],
    );

    if (existingOrganization.rows.length) {
      return res.status(409).json({
        error:
          "A Company with this official domain or email is already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const verificationCode = cryptoSafeSixDigitCode();

    const codeHash = crypto
      .createHash("sha256")
      .update(verificationCode)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `
      DELETE FROM company_signup_verifications
      WHERE LOWER(admin_email) = $1
         OR LOWER(company_email) = $2
         OR LOWER(company_domain) = $3
      `,
      [administratorEmail, officialEmail, officialDomain],
    );

    const pendingResult = await pool.query(
      `
      INSERT INTO company_signup_verifications
      (
        company_name,
        company_email,
        website,
        industry,
        company_size,
        country,
        company_domain,
        admin_name,
        admin_email,
        password,
        verification_code_hash,
        expires_at
      )
      VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
      `,
      [
        company,
        officialEmail,
        normalizedWebsite,
        normalizedIndustry,
        normalizedSize,
        normalizedCountry,
        officialDomain,
        administrator,
        administratorEmail,
        hashedPassword,
        codeHash,
        expiresAt,
      ],
    );

    try {
      await sendVerificationEmail(officialEmail, company, verificationCode);
    } catch (emailError) {
      await pool.query(
        `
        DELETE FROM company_signup_verifications
        WHERE id = $1
        `,
        [pendingResult.rows[0].id],
      );

      throw emailError;
    }

    return res.status(201).json({
      message: `A verification code has been sent to ${officialEmail}. It expires in 10 minutes.`,
      companyEmail: officialEmail,
    });
  } catch (error) {
    console.error("Company signup start error:", error.message);

    return res.status(500).json({
      error:
        "Unable to start Company signup. Please check email configuration and try again.",
    });
  }
});

/*
 * =========================================================
 * PUBLIC COMPANY SIGNUP — VERIFY EMAIL AND CREATE COMPANY
 * =========================================================
 */

router.post("/company-signup/verify", async (req, res) => {
  const officialEmail = String(req.body?.companyEmail || "")
    .trim()
    .toLowerCase();

  const suppliedCode = String(req.body?.verificationCode || "").trim();

  if (!EMAIL_PATTERN.test(officialEmail) || !/^\d{6}$/.test(suppliedCode)) {
    return res.status(400).json({
      error:
        "A valid Company email and six-digit verification code are required.",
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not configured.");

    return res.status(500).json({
      error: "Authentication is not configured. Please contact support.",
    });
  }

  const client = await pool.connect();

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const pendingResult = await client.query(
      `
      SELECT *
      FROM company_signup_verifications
      WHERE LOWER(company_email) = $1
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [officialEmail],
    );

    if (!pendingResult.rows.length) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(400).json({
        error:
          "No pending Company verification was found. Please start signup again.",
      });
    }

    const pending = pendingResult.rows[0];

    if (new Date() > new Date(pending.expires_at)) {
      await client.query(
        `
        DELETE FROM company_signup_verifications
        WHERE id = $1
        `,
        [pending.id],
      );

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(400).json({
        error: "The verification code has expired. Please start signup again.",
      });
    }

    if (pending.attempts >= 5) {
      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(429).json({
        error:
          "Too many incorrect verification attempts. Please start signup again.",
      });
    }

    const suppliedHash = crypto
      .createHash("sha256")
      .update(suppliedCode)
      .digest();

    const storedHash = Buffer.from(
      String(pending.verification_code_hash).trim(),
      "hex",
    );

    const codeIsValid =
      storedHash.length === suppliedHash.length &&
      crypto.timingSafeEqual(suppliedHash, storedHash);

    if (!codeIsValid) {
      await client.query(
        `
        UPDATE company_signup_verifications
        SET attempts = attempts + 1
        WHERE id = $1
        `,
        [pending.id],
      );

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(400).json({
        error: "Invalid verification code.",
      });
    }

    /*
     * Check administrator email availability.
     */

    const normalizedAdminEmail = String(pending.admin_email)
      .trim()
      .toLowerCase();

    const existingAdmin = await client.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [normalizedAdminEmail],
    );

    if (existingAdmin.rows.length) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        error:
          "The administrator email already belongs to an account. Please sign in or use another email.",
      });
    }

    /*
     * Check organization availability.
     */

    const existingOrganization = await client.query(
      `
      SELECT id
      FROM organizations
      WHERE LOWER(official_domain) = $1
         OR LOWER(official_email) = $2
      LIMIT 1
      `,
      [String(pending.company_domain).toLowerCase(), officialEmail],
    );

    if (existingOrganization.rows.length) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        error:
          "A Company with this official domain or email is already registered.",
      });
    }

    /*
     * Create the administrator.
     *
     * The password in the pending table is already a bcrypt hash.
     * Do not hash it again.
     */

    const userResult = await client.query(
      `
      INSERT INTO users
      (
        name,
        email,
        password,
        role,
        account_status,
        must_change_password
      )
      VALUES
      ($1, $2, $3, 'ADMIN', 'ACTIVE', FALSE)
      RETURNING
        id,
        name,
        email,
        role,
        created_at,
        account_status,
        must_change_password
      `,
      [pending.admin_name, normalizedAdminEmail, pending.password],
    );

    const admin = userResult.rows[0];

    /*
     * Create organization.
     */

    const organizationResult = await client.query(
      `
      INSERT INTO organizations
      (
        organization_id,
        name,
        type,
        official_email,
        official_domain,
        verification_status,
        created_by,
        website,
        industry,
        company_size,
        country
      )
      VALUES
      ($1, $2, 'COMPANY', $3, $4, 'VERIFIED', $5, $6, $7, $8, $9)
      RETURNING
        id,
        organization_id,
        name,
        type,
        official_email,
        official_domain,
        verification_status,
        created_by,
        website,
        industry,
        company_size,
        country,
        created_at
      `,
      [
        createCompanySignupOrganizationId(),
        pending.company_name,
        officialEmail,
        String(pending.company_domain).toLowerCase(),
        admin.id,
        pending.website,
        pending.industry,
        pending.company_size,
        pending.country,
      ],
    );

    const organization = organizationResult.rows[0];

    /*
     * Create Company workspace.
     */

    const workspaceResult = await client.query(
      `
      INSERT INTO workspaces
      (
        name,
        type,
        created_by,
        organization_id
      )
      VALUES
      ($1, 'COMPANY', $2, $3)
      RETURNING
        id,
        name,
        type,
        created_by,
        organization_id,
        created_at
      `,
      [pending.company_name, admin.id, organization.id],
    );

    const workspace = workspaceResult.rows[0];

    /*
     * Add ADMIN workspace membership.
     */

    const membershipResult = await client.query(
      `
      INSERT INTO workspace_members
      (
        workspace_id,
        user_id,
        role
      )
      VALUES
      ($1, $2, 'ADMIN')
      RETURNING
        id,
        workspace_id,
        user_id,
        role,
        joined_at
      `,
      [workspace.id, admin.id],
    );

    /*
     * Add organization membership.
     */

    await client.query(
      `
      INSERT INTO organization_members
      (organization_id, user_id)
      VALUES
      ($1, $2)
      `,
      [organization.id, admin.id],
    );

    /*
     * Delete completed verification record.
     */

    await client.query(
      `
      DELETE FROM company_signup_verifications
      WHERE id = $1
      `,
      [pending.id],
    );

    /*
     * Generate JWT before committing.
     * If signing fails, the database transaction rolls back.
     */

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    /*
     * Commit all records.
     */

    await client.query("COMMIT");
    transactionStarted = false;

    console.log(
      `Company signup completed successfully for administrator ID ${admin.id}.`,
    );

    /*
     * Return the token at the TOP LEVEL.
     */

    return res.status(201).json({
      success: true,
      message:
        "Company email verified and Company workspace created successfully.",
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        account_status: admin.account_status,
        must_change_password: admin.must_change_password,
      },
      organization,
      workspace,
      membership: membershipResult.rows[0],
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Company verification rollback error:",
          rollbackError.message,
        );
      }
    }

    console.error("Company signup verification error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error:
          "A duplicate account or organization was detected. Please check the Company details.",
      });
    }

    return res.status(500).json({
      error: "Unable to complete Company verification. Please try again.",
    });
  } finally {
    client.release();
  }
});

module.exports = router;
