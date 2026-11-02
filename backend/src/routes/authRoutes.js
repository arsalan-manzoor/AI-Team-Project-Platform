const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { rateLimit } = require("express-rate-limit");

const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const { verifyGoogleToken } = require("../utils/googleAuth");
const { sendPasswordResetEmail } = require("../utils/emailService");

const router = express.Router();

// ============================================================
// AUTHENTICATION RATE LIMITING
// ============================================================

const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const createAuthLimiter = ({
  limit,
  message,
  skipSuccessfulRequests = false,
}) =>
  rateLimit({
    windowMs: AUTH_WINDOW_MS,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,

    handler: (req, res) => {
      return res.status(429).json({
        error: message,
        code: "RATE_LIMIT_EXCEEDED",
      });
    },
  });

// Login: 10 failed attempts per 15 minutes.
const loginLimiter = createAuthLimiter({
  limit: 10,
  message: "Too many login attempts. Please try again after 15 minutes.",
  skipSuccessfulRequests: true,
});

// Forgot password: 5 requests per 15 minutes.
const forgotPasswordLimiter = createAuthLimiter({
  limit: 5,
  message: "Too many password reset requests. Please try again later.",
});

// Reset password: 5 failed attempts per 15 minutes.
const resetPasswordLimiter = createAuthLimiter({
  limit: 5,
  message: "Too many password reset attempts. Please try again later.",
  skipSuccessfulRequests: true,
});

// Google authentication: 10 failed attempts per 15 minutes.
const googleAuthLimiter = createAuthLimiter({
  limit: 10,
  message: "Too many Google authentication attempts. Please try again later.",
  skipSuccessfulRequests: true,
});

// Initial password change: 5 failed attempts per 15 minutes.
const initialPasswordLimiter = createAuthLimiter({
  limit: 5,
  message: "Too many password change attempts. Please try again later.",
  skipSuccessfulRequests: true,
});

// ============================================================
// EMAIL + PASSWORD LOGIN
//
// POST /api/auth/login
// ============================================================

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};

  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
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
        account_status,
        must_change_password
      FROM users
      WHERE LOWER(TRIM(email)) = $1
      LIMIT 1
      `,
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    if (user.account_status !== "ACTIVE") {
      return res.status(403).json({
        error: `Your ZYRA account is currently ${String(
          user.account_status,
        ).toLowerCase()}. Please contact your administrator.`,
        account_status: user.account_status,
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");

      return res.status(500).json({
        error: "Authentication is temporarily unavailable.",
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

    // --------------------------------------------------------
    // NOTIFY ABOUT PENDING COMPANY INVITATIONS
    // --------------------------------------------------------

    // Notification failure must not prevent login.
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
          )
        `,
        [user.id, normalizedEmail],
      );
    } catch (notificationError) {
      console.error(
        "Employee invitation notification error:",
        notificationError.message,
      );
    }

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        account_status: user.account_status,
        must_change_password: user.must_change_password,
      },
      must_change_password: user.must_change_password,
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

// ============================================================
// FORGOT PASSWORD
//
// POST /api/auth/forgot-password
// ============================================================

router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body || {};

  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({
      error: "Please enter your email address.",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // --------------------------------------------------------
  // DETERMINE REQUESTING PORTAL
  // --------------------------------------------------------

  const requestedPortal = String(req.body?.portal || "INDIVIDUAL")
    .trim()
    .toUpperCase();

  if (!["INDIVIDUAL", "COMPANY"].includes(requestedPortal)) {
    return res.status(400).json({
      error: "Invalid password reset portal.",
    });
  }

  // --------------------------------------------------------
  // VALIDATE EMAIL
  // --------------------------------------------------------

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({
      error: "Please enter a valid email address.",
    });
  }

  try {
    // ------------------------------------------------------
    // FIND ACCOUNT
    // ------------------------------------------------------

    const result = await pool.query(
      `
        SELECT
          id,
          name,
          email,
          account_status
        FROM users
        WHERE LOWER(TRIM(email)) = $1
        LIMIT 1
        `,
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error:
          "No ZYRA account is registered with this email address. Please check your email or create an account.",
      });
    }

    const user = result.rows[0];

    // ------------------------------------------------------
    // CHECK ACCOUNT STATUS
    // ------------------------------------------------------

    if (user.account_status !== "ACTIVE") {
      return res.status(403).json({
        error: `Your ZYRA account is currently ${String(
          user.account_status,
        ).toLowerCase()}. Please contact your administrator.`,
      });
    }

    // ------------------------------------------------------
    // CHECK EMAIL CONFIGURATION
    // ------------------------------------------------------

    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      console.error(
        "Password reset failed: email environment variables are missing.",
      );

      return res.status(500).json({
        error:
          "ZYRA email delivery is not configured correctly. Please contact the administrator.",
      });
    }

    // ------------------------------------------------------
    // GENERATE SECURE RESET TOKEN
    // ------------------------------------------------------

    const resetToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Remove previously generated reset tokens.
    await pool.query(
      `
        DELETE FROM password_reset_tokens
        WHERE user_id = $1
        `,
      [user.id],
    );

    // Create a new token with 20-minute expiry.
    await pool.query(
      `
        INSERT INTO password_reset_tokens
        (
          user_id,
          token_hash,
          expires_at
        )
        VALUES
        (
          $1,
          $2,
          CURRENT_TIMESTAMP + INTERVAL '20 minutes'
        )
        `,
      [user.id, tokenHash],
    );

    // ------------------------------------------------------
    // GENERATE PORTAL-SPECIFIC RESET URL
    // ------------------------------------------------------

    const frontendBaseUrl = (
      process.env.FRONTEND_URL || "http://localhost:5173"
    ).replace(/\/+$/, "");

    const resetPath =
      requestedPortal === "COMPANY" ? "/company/login" : "/login";

    const resetUrl =
      `${frontendBaseUrl}${resetPath}?token=` + encodeURIComponent(resetToken);

    // ------------------------------------------------------
    // SEND PASSWORD RESET EMAIL
    // ------------------------------------------------------

    try {
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    } catch (emailError) {
      // Remove token if email delivery fails.
      try {
        await pool.query(
          `
            DELETE FROM password_reset_tokens
            WHERE token_hash = $1
            `,
          [tokenHash],
        );
      } catch (cleanupError) {
        console.error(
          "Password reset token cleanup error:",
          cleanupError.message,
        );
      }

      console.error("Password reset email delivery error:", emailError.message);

      return res.status(500).json({
        error:
          "Your ZYRA account was found, but we couldn't send the password reset email. Please check the email configuration or try again later.",
      });
    }

    console.log(
      `Password reset email accepted for ${user.email}. Portal: ${requestedPortal}`,
    );

    return res.json({
      message: `Password reset email sent to ${user.email}. Please check your inbox and spam folder.`,
    });
  } catch (error) {
    console.error("Forgot password endpoint error:", error.message);

    return res.status(500).json({
      error:
        "Unable to process your password reset request. Please try again later.",
    });
  }
});

// ============================================================
// RESET PASSWORD
//
// POST /api/auth/reset-password
// ============================================================

router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  const { token, password } = req.body || {};

  if (typeof token !== "string" || !token.trim()) {
    return res.status(400).json({
      error: "The password reset token is missing.",
    });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({
      error: "Your new password must contain at least 8 characters.",
    });
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({
      error: "Your password must not exceed 72 bytes.",
    });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    // ------------------------------------------------------
    // FIND VALID RESET TOKEN
    // ------------------------------------------------------

    const tokenResult = await client.query(
      `
        SELECT
          id,
          user_id
        FROM password_reset_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        FOR UPDATE
        `,
      [tokenHash],
    );

    if (tokenResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error:
          "This password reset link is invalid or has expired. Please request a new one.",
      });
    }

    const resetRecord = tokenResult.rows[0];

    // ------------------------------------------------------
    // HASH NEW PASSWORD
    // ------------------------------------------------------

    const hashedPassword = await bcrypt.hash(password, 10);

    // ------------------------------------------------------
    // UPDATE USER PASSWORD
    // ------------------------------------------------------

    const updateResult = await client.query(
      `
        UPDATE users
        SET
          password = $1,
          must_change_password = FALSE
        WHERE id = $2
          AND account_status = 'ACTIVE'
        RETURNING id
        `,
      [hashedPassword, resetRecord.user_id],
    );

    if (updateResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error:
          "This password reset link is invalid or has expired, or the account is no longer active. Please request a new link or contact your administrator.",
      });
    }

    // ------------------------------------------------------
    // MARK CURRENT TOKEN AS USED
    // ------------------------------------------------------

    await client.query(
      `
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND used_at IS NULL
        `,
      [resetRecord.id],
    );

    // ------------------------------------------------------
    // INVALIDATE OTHER RESET TOKENS
    // ------------------------------------------------------

    await client.query(
      `
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND id <> $2
          AND used_at IS NULL
        `,
      [resetRecord.user_id, resetRecord.id],
    );

    await client.query("COMMIT");

    console.log(`Password reset completed for user ID ${resetRecord.user_id}.`);

    return res.json({
      message:
        "Your password has been reset successfully. You can now sign in using your new password.",
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Password reset rollback error:", rollbackError.message);
      }
    }

    console.error("Reset password endpoint error:", error.message);

    return res.status(500).json({
      error: "Unable to reset your password right now. Please try again later.",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// ============================================================
// CHANGE INITIAL PASSWORD
//
// POST /api/auth/change-initial-password
// ============================================================

// Authentication runs before rate limiting here so that
// unauthenticated requests cannot exhaust a user's password-change
// allowance.

router.post(
  "/change-initial-password",
  authMiddleware,
  initialPasswordLimiter,
  async (req, res) => {
    const { newPassword, confirmPassword } = req.body || {};

    if (
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string" ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        error: "Enter your new password and confirm it.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: "Your new password must contain at least 8 characters.",
      });
    }

    if (Buffer.byteLength(newPassword, "utf8") > 72) {
      return res.status(400).json({
        error: "Your password must not exceed 72 bytes.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: "Your passwords do not match.",
      });
    }

    try {
      const accountResult = await pool.query(
        `
        SELECT
          id,
          name,
          email,
          account_status,
          must_change_password
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [req.user.id],
      );

      if (accountResult.rows.length === 0) {
        return res.status(404).json({
          error: "Your ZYRA account could not be found.",
        });
      }

      const account = accountResult.rows[0];

      if (account.account_status !== "ACTIVE") {
        return res.status(403).json({
          error: "Your ZYRA account is not active.",
        });
      }

      if (!account.must_change_password) {
        return res.status(409).json({
          error: "Your account does not require an initial password change.",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const updateResult = await pool.query(
        `
        UPDATE users
        SET
          password = $1,
          must_change_password = FALSE
        WHERE id = $2
          AND account_status = 'ACTIVE'
          AND must_change_password = TRUE
        RETURNING
          id,
          name,
          email,
          account_status,
          must_change_password
        `,
        [hashedPassword, req.user.id],
      );

      if (updateResult.rows.length === 0) {
        return res.status(409).json({
          error:
            "Your password has already been changed or the account status has changed. Please refresh and sign in again if necessary.",
        });
      }

      const updatedUser = updateResult.rows[0];

      return res.json({
        message: "Your password has been changed successfully.",
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          account_status: updatedUser.account_status,
          must_change_password: updatedUser.must_change_password,
        },
        must_change_password: false,
      });
    } catch (error) {
      console.error("Initial password change error:", error.message);

      return res.status(500).json({
        error: "Unable to change your password. Please try again.",
      });
    }
  },
);

// ============================================================
// GOOGLE LOGIN / SIGNUP
//
// POST /api/auth/google
// ============================================================

router.post("/google", googleAuthLimiter, async (req, res) => {
  const { idToken } = req.body || {};

  const authMode = String(req.body?.authMode || "LOGIN")
    .trim()
    .toUpperCase();

  const requestedWorkspaceType = String(req.body?.workspaceType || "INDIVIDUAL")
    .trim()
    .toUpperCase();

  if (!["LOGIN", "SIGNUP"].includes(authMode)) {
    return res.status(400).json({
      error: "Invalid Google authentication mode.",
    });
  }

  if (!["INDIVIDUAL", "COMPANY"].includes(requestedWorkspaceType)) {
    return res.status(400).json({
      error: "Invalid workspace type.",
    });
  }

  if (authMode === "SIGNUP" && requestedWorkspaceType !== "INDIVIDUAL") {
    return res.status(403).json({
      error:
        "Google Sign-Up is currently available only for Individual Workspace accounts.",
    });
  }

  if (typeof idToken !== "string" || !idToken.trim()) {
    return res.status(400).json({
      error: "Google ID token is required.",
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not configured.");

    return res.status(500).json({
      error: "Authentication is temporarily unavailable.",
    });
  }

  let client;
  let transactionStarted = false;
  let user;
  let createdNewAccount = false;
  let individualWorkspaceCreated = false;
  let workspaceName = null;

  try {
    // ======================================================
    // STEP 1: VERIFY GOOGLE IDENTITY
    // ======================================================

    const googleUser = await verifyGoogleToken(idToken);

    const googleId = googleUser.sub;
    const email = googleUser.email?.trim().toLowerCase();
    const name = googleUser.name?.trim();

    if (!googleId || !email || !name) {
      return res.status(400).json({
        error: "Google account information is incomplete.",
      });
    }

    if (googleUser.email_verified !== true) {
      return res.status(400).json({
        error: "Your Google email address must be verified.",
      });
    }

    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    // ======================================================
    // STEP 2: FIND ACCOUNT USING GOOGLE ID
    // ======================================================

    const googleAccountResult = await client.query(
      `
        SELECT
          id,
          name,
          email,
          google_id,
          account_status,
          must_change_password
        FROM users
        WHERE google_id = $1
        LIMIT 1
        FOR UPDATE
        `,
      [googleId],
    );

    if (googleAccountResult.rows.length > 0) {
      user = googleAccountResult.rows[0];
    } else {
      // ====================================================
      // STEP 3: CHECK ACCOUNT USING VERIFIED GOOGLE EMAIL
      // ====================================================

      const existingEmailResult = await client.query(
        `
          SELECT
            id,
            name,
            email,
            google_id,
            account_status,
            must_change_password
          FROM users
          WHERE LOWER(TRIM(email)) = $1
          LIMIT 1
          FOR UPDATE
          `,
        [email],
      );

      if (existingEmailResult.rows.length > 0) {
        const existingUser = existingEmailResult.rows[0];

        if (existingUser.google_id && existingUser.google_id !== googleId) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(409).json({
            error:
              "This ZYRA account is linked to another Google account. Please use your existing sign-in method.",
          });
        }

        // --------------------------------------------------
        // LINK GOOGLE TO EXISTING ZYRA ACCOUNT
        // --------------------------------------------------

        if (!existingUser.google_id) {
          const linkResult = await client.query(
            `
              UPDATE users
              SET google_id = $1
              WHERE id = $2
                AND google_id IS NULL
              RETURNING
                id,
                name,
                email,
                google_id,
                account_status,
                must_change_password
              `,
            [googleId, existingUser.id],
          );

          if (linkResult.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(409).json({
              error:
                "This account was updated by another request. Please try signing in again.",
            });
          }

          user = linkResult.rows[0];
        } else {
          user = existingUser;
        }
      } else {
        // ==================================================
        // STEP 4: PREVENT NEW ACCOUNT CREATION DURING LOGIN
        // ==================================================

        if (authMode === "LOGIN") {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(404).json({
            error:
              "No ZYRA account was found for this Google email. Please sign up first.",
            code: "ACCOUNT_NOT_FOUND",
          });
        }

        // ==================================================
        // STEP 5: CREATE ACCOUNT DURING INDIVIDUAL SIGNUP
        // ==================================================

        const internalPassword = crypto.randomBytes(32).toString("hex");

        const hashedPassword = await bcrypt.hash(internalPassword, 10);

        const newUserResult = await client.query(
          `
            INSERT INTO users
            (
              name,
              email,
              password,
              role,
              google_id
            )
            VALUES
            (
              $1,
              $2,
              $3,
              'TEAM_LEADER',
              $4
            )
            RETURNING
              id,
              name,
              email,
              google_id,
              account_status,
              must_change_password
            `,
          [name, email, hashedPassword, googleId],
        );

        user = newUserResult.rows[0];
        createdNewAccount = true;
      }
    }

    // ======================================================
    // STEP 6: CHECK ACCOUNT STATUS
    // ======================================================

    if (user.account_status !== "ACTIVE") {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error: `Your ZYRA account is currently ${String(
          user.account_status,
        ).toLowerCase()}. Please contact your administrator.`,
        account_status: user.account_status,
      });
    }

    // ======================================================
    // STEP 7: FETCH EXISTING WORKSPACE MEMBERSHIPS
    // ======================================================

    const membershipResult = await client.query(
      `
        SELECT
          wm.workspace_id,
          wm.role,
          w.type
        FROM workspace_members wm
        INNER JOIN workspaces w
          ON w.id = wm.workspace_id
        WHERE wm.user_id = $1
        `,
      [user.id],
    );

    const memberships = membershipResult.rows;

    const hasIndividualMembership = memberships.some(
      (membership) =>
        String(membership.type).trim().toUpperCase() === "INDIVIDUAL",
    );

    const hasCompanyMembership = memberships.some(
      (membership) =>
        String(membership.type).trim().toUpperCase() === "COMPANY",
    );

    const hasAnyMembership = memberships.length > 0;

    // ======================================================
    // STEP 8: CHECK PENDING COMPANY INVITATION
    // ======================================================

    const pendingInvitationResult = await client.query(
      `
        SELECT ei.id
        FROM employee_invitations ei
        INNER JOIN workspaces w
          ON w.id = ei.workspace_id
        INNER JOIN organizations o
          ON o.id = w.organization_id
        WHERE LOWER(TRIM(ei.invited_email)) = $1
          AND ei.status = 'PENDING'
          AND ei.expires_at > CURRENT_TIMESTAMP
          AND w.type = 'COMPANY'
          AND o.verification_status = 'VERIFIED'
        LIMIT 1
        `,
      [user.email],
    );

    const hasPendingCompanyInvitation = pendingInvitationResult.rows.length > 0;

    // ======================================================
    // STEP 9: INDIVIDUAL WORKSPACE ACCESS
    // ======================================================

    if (requestedWorkspaceType === "INDIVIDUAL") {
      /*
       * LOGIN:
       * Never create an Individual Workspace here.
       *
       * SIGNUP:
       * Create an Individual Workspace only when the account
       * has no other workspace membership and no pending
       * Company invitation.
       */

      if (authMode === "SIGNUP" && !hasIndividualMembership) {
        if (hasAnyMembership || hasPendingCompanyInvitation) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(403).json({
            error:
              "This account already belongs to a Company or has a pending Company invitation. Please use Company Sign In.",
            code: "COMPANY_ACCOUNT_EXISTS",
          });
        }

        const existingWorkspaceResult = await client.query(
          `
            SELECT
              id,
              name
            FROM workspaces
            WHERE created_by = $1
              AND type = 'INDIVIDUAL'
            ORDER BY created_at ASC
            LIMIT 1
            `,
          [user.id],
        );

        let workspace;

        if (existingWorkspaceResult.rows.length > 0) {
          workspace = existingWorkspaceResult.rows[0];
        } else {
          const individualWorkspaceName = `${user.name}'s Individual Workspace`;

          const workspaceResult = await client.query(
            `
              INSERT INTO workspaces
              (
                name,
                type,
                created_by
              )
              VALUES
              (
                $1,
                'INDIVIDUAL',
                $2
              )
              RETURNING
                id,
                name
              `,
            [individualWorkspaceName, user.id],
          );

          workspace = workspaceResult.rows[0];
        }

        await client.query(
          `
            INSERT INTO workspace_members
            (
              workspace_id,
              user_id,
              role
            )
            VALUES
            (
              $1,
              $2,
              'TEAM_LEADER'
            )
            ON CONFLICT (workspace_id, user_id) DO NOTHING
            `,
          [workspace.id, user.id],
        );

        individualWorkspaceCreated = true;
        workspaceName = workspace.name;
      }
    }

    // ======================================================
    // STEP 10: COMPANY WORKSPACE ACCESS
    // ======================================================

    if (
      requestedWorkspaceType === "COMPANY" &&
      !hasCompanyMembership &&
      !hasPendingCompanyInvitation
    ) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        error:
          "This account does not have Company Workspace access or a pending Company invitation.",
      });
    }

    // ======================================================
    // STEP 11: COMMIT
    // ======================================================

    await client.query("COMMIT");
    transactionStarted = false;

    // ======================================================
    // STEP 12: NOTIFY ABOUT COMPANY INVITATIONS
    // ======================================================

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
            )
          `,
        [user.id, email],
      );
    } catch (notificationError) {
      console.error(
        "Google invitation notification error:",
        notificationError.message,
      );
    }

    // ======================================================
    // STEP 13: ISSUE JWT
    // ======================================================

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

    return res.status(createdNewAccount ? 201 : 200).json({
      message: createdNewAccount
        ? "Google account and Individual Workspace created successfully."
        : "Google authentication successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        account_status: user.account_status,
        must_change_password: user.must_change_password,
      },
      must_change_password: user.must_change_password,
      individualWorkspaceCreated,
      workspaceName,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Google authentication rollback error:",
          rollbackError.message,
        );
      }
    }

    if (error.code === "23505") {
      return res.status(409).json({
        error:
          "This account or Google identity already exists. Please try signing in again.",
      });
    }

    console.error("Google authentication error:", error.message);

    return res.status(401).json({
      error: "Google authentication failed. Please try again.",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// ============================================================
// CURRENT LOGGED-IN USER
//
// GET /api/auth/me
// ============================================================

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        created_at,
        account_status,
        must_change_password
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

    return res.json({
      ...result.rows[0],
      must_change_password: result.rows[0].must_change_password,
    });
  } catch (error) {
    console.error("User fetch error:", error.message);

    return res.status(500).json({
      error: "Database error",
    });
  }
});

// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;
