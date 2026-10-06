const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const { verifyGoogleToken } = require("../utils/googleAuth");

const router = express.Router();

/*
 * Email + Password Login
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required",
    });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        password,
        account_status
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    /*
     * Account activation/status check.
     *
     * Only ACTIVE accounts are allowed to log in.
     */
    if (user.account_status !== "ACTIVE") {
      return res.status(403).json({
        error: `Your ZYRA account is currently ${user.account_status.toLowerCase()}. Please contact your administrator.`,
        account_status: user.account_status,
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    /*
     * Check for valid pending employee invitations
     * belonging to the logged-in user's email.
     *
     * A notification is created only once for each
     * pending invitation.
     *
     * The raw invitation token is never stored
     * inside the notification.
     */
    try {
      await pool.query(
        `
        INSERT INTO notifications
        (
          user_id,
          title,
          message,
          notification_type,
          reference_id
        )
        SELECT
          $1,
          'Workspace Invitation',
          CONCAT(
            'You have been invited to join ',
            w.name,
            ' as ',
            ei.role,
            '.'
          ),
          'EMPLOYEE_INVITATION',
          ei.id
        FROM employee_invitations ei
        INNER JOIN workspaces w
          ON w.id = ei.workspace_id
        INNER JOIN organizations o
          ON o.id = w.organization_id
        WHERE LOWER(TRIM(ei.invited_email)) = $2
          AND ei.status = 'PENDING'
          AND ei.expires_at > CURRENT_TIMESTAMP
          AND w.type = 'COMPANY'
          AND o.verification_status = 'VERIFIED'
          AND NOT EXISTS (
            SELECT 1
            FROM workspace_members wm
            WHERE wm.workspace_id = ei.workspace_id
              AND wm.user_id = $1
          )
          AND NOT EXISTS (
            SELECT 1
            FROM notifications n
            WHERE n.user_id = $1
              AND n.notification_type = 'EMPLOYEE_INVITATION'
              AND n.reference_id = ei.id
          );
        `,
        [user.id, normalizedEmail],
      );
    } catch (notificationError) {
      /*
       * Notification creation should never prevent
       * a valid user from logging into ZYRA.
       */
      console.error(
        "Employee invitation notification error:",
        notificationError.message,
      );
    }

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        account_status: user.account_status,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

/*
 * Google Login / Signup
 */
router.post("/google", async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      error: "Google ID token is required",
    });
  }

  try {
    const googleUser = await verifyGoogleToken(idToken);

    const googleId = googleUser.sub;
    const email = googleUser.email?.trim().toLowerCase();
    const name = googleUser.name?.trim();

    if (!googleId || !email || !name) {
      return res.status(400).json({
        error: "Google account information is incomplete",
      });
    }

    if (!googleUser.email_verified) {
      return res.status(400).json({
        error: "Google email is not verified",
      });
    }

    /*
     * First try to find an existing Google account.
     */
    const googleAccount = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        account_status
      FROM users
      WHERE google_id = $1
      `,
      [googleId],
    );

    if (googleAccount.rows.length > 0) {
      const user = googleAccount.rows[0];

      /*
       * Only ACTIVE accounts are allowed to use
       * Google login.
       */
      if (user.account_status !== "ACTIVE") {
        return res.status(403).json({
          error: `Your ZYRA account is currently ${user.account_status.toLowerCase()}. Please contact your administrator.`,
          account_status: user.account_status,
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "7d",
        },
      );

      return res.json({
        message: "Google login successful",
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          account_status: user.account_status,
        },
      });
    }

    /*
     * Check whether this email already belongs to
     * an existing normal ZYRA account.
     */
    const existingEmail = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        google_id,
        account_status
      FROM users
      WHERE email = $1
      `,
      [email],
    );

    if (existingEmail.rows.length > 0) {
      const existingUser = existingEmail.rows[0];

      /*
       * We do not automatically attach Google to an existing
       * password account yet.
       */
      if (!existingUser.google_id) {
        return res.status(409).json({
          error:
            "An account with this email already exists. Please sign in with your ZYRA password first.",
        });
      }

      /*
       * Existing Google-linked account with a non-active status.
       */
      if (existingUser.account_status !== "ACTIVE") {
        return res.status(403).json({
          error: `Your ZYRA account is currently ${existingUser.account_status.toLowerCase()}. Please contact your administrator.`,
          account_status: existingUser.account_status,
        });
      }
    }

    /*
     * Create a secure random internal password because the
     * current users.password column is NOT NULL.
     *
     * The user never receives or uses this password.
     *
     * account_status automatically becomes ACTIVE because
     * the database column has DEFAULT 'ACTIVE'.
     */
    const internalPassword = crypto.randomBytes(32).toString("hex");
    const hashedPassword = await bcrypt.hash(internalPassword, 10);

    const result = await pool.query(
      `
      INSERT INTO users
      (name, email, password, google_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, created_at, account_status
      `,
      [name, email, hashedPassword, googleId],
    );

    const user = result.rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    return res.status(201).json({
      message: "Google account created successfully",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        account_status: user.account_status,
      },
    });
  } catch (error) {
    console.error("Google authentication error:", error.message);

    res.status(401).json({
      error: "Google authentication failed",
    });
  }
});

/*
 * Current Logged-In User
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        created_at,
        account_status
      FROM users
      WHERE id = $1
      `,
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const user = result.rows[0];

    res.json(user);
  } catch (error) {
    console.error("User fetch error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

module.exports = router;
