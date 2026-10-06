const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Access token required",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /*
     * Check the user's current account status in the database.
     *
     * This prevents an already-issued JWT from continuing
     * to access ZYRA after the account has been suspended
     * or otherwise deactivated.
     */
    const result = await pool.query(
      `
      SELECT
        id,
        email,
        account_status
      FROM users
      WHERE id = $1
      `,
      [decoded.id],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "User account not found",
      });
    }

    const user = result.rows[0];

    /*
     * Only ACTIVE accounts can access protected routes.
     */
    if (user.account_status !== "ACTIVE") {
      return res.status(403).json({
        error: `Your ZYRA account is currently ${user.account_status.toLowerCase()}. Please contact your administrator.`,
        account_status: user.account_status,
      });
    }

    /*
     * Attach authenticated user information to the request.
     */
    req.user = {
      id: user.id,
      email: user.email,
      account_status: user.account_status,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
};

module.exports = authMiddleware;
