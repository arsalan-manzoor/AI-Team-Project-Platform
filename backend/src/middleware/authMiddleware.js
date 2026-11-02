const jwt = require("jsonwebtoken");
const pool = require("../config/db");

/*
 * =========================================================
 * ZYRA — AUTHENTICATION MIDDLEWARE
 * =========================================================
 *
 * 1. Verify the JWT.
 * 2. Check the latest account status in PostgreSQL.
 * 3. Enforce mandatory initial password changes.
 *
 * While must_change_password is TRUE, only these requests
 * are permitted:
 *
 * GET  /api/auth/me
 * POST /api/auth/change-initial-password
 */

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Access token required",
      code: "AUTHENTICATION_REQUIRED",
    });
  }

  const token = authHeader.substring("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({
      error: "Access token required",
      code: "AUTHENTICATION_REQUIRED",
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");

      return res.status(500).json({
        error: "Authentication is temporarily unavailable.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Retrieve the latest account information from PostgreSQL.
    const result = await pool.query(
      `
      SELECT
        id,
        email,
        account_status,
        must_change_password
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [decoded.id],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "User account not found",
        code: "ACCOUNT_NOT_FOUND",
      });
    }

    const user = result.rows[0];

    // Reject suspended or otherwise inactive accounts.
    if (user.account_status !== "ACTIVE") {
      return res.status(403).json({
        error: `Your ZYRA account is currently ${String(
          user.account_status,
        ).toLowerCase()}. Please contact your administrator.`,
        code: "ACCOUNT_NOT_ACTIVE",
        account_status: user.account_status,
      });
    }

    /*
     * Preserve existing verified JWT claims while replacing
     * account information with the latest database values.
     *
     * This maintains compatibility with existing routes and
     * AI services that use req.user.id or other JWT claims.
     */
    req.user = {
      ...decoded,
      id: user.id,
      email: user.email,
      account_status: user.account_status,
      must_change_password: user.must_change_password,
    };

    // Determine the requested endpoint.
    const requestPath = String(req.originalUrl || req.url || "").split("?")[0];

    const requestMethod = req.method.toUpperCase();

    // Allow the mandatory password-change endpoint.
    const isInitialPasswordChangeRequest =
      requestMethod === "POST" &&
      /\/api\/auth\/change-initial-password\/?$/.test(requestPath);

    // Allow the current-user endpoint.
    const isCurrentUserRequest =
      requestMethod === "GET" && /\/api\/auth\/me\/?$/.test(requestPath);

    /*
     * Block all other protected API requests until the employee
     * changes their initial password.
     */
    if (
      user.must_change_password === true &&
      !isInitialPasswordChangeRequest &&
      !isCurrentUserRequest
    ) {
      return res.status(403).json({
        error:
          "You must change your temporary password before accessing this feature.",
        code: "PASSWORD_CHANGE_REQUIRED",
        must_change_password: true,
      });
    }

    return next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(401).json({
      error: "Invalid or expired token",
      code: "INVALID_OR_EXPIRED_TOKEN",
    });
  }
};

module.exports = authMiddleware;
