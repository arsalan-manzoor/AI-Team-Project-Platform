const bcrypt = require("bcrypt");
const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const { sendVerificationEmail } = require("../utils/emailService");

const router = express.Router();

router.use(express.json());

// Get all users
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, created_at FROM users",
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Database error:", error.message);

    res.status(500).json({
      error: "Database error",
    });
  }
});

// Create a new user / Start sign up
router.post("/", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Name, email and password are required",
    });
  }

  try {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

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

    // Check whether the email already belongs to an existing account
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail],
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: "Email already exists",
      });
    }

    // Remove any previous pending verification for this email
    await pool.query("DELETE FROM email_verifications WHERE email = $1", [
      normalizedEmail,
    ]);

    // Hash the ZYRA password before storing it temporarily
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a 6-digit verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    // Code expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO email_verifications
             (name, email, password, verification_code, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
      [
        normalizedName,
        normalizedEmail,
        hashedPassword,
        verificationCode,
        expiresAt,
      ],
    );

    // Send verification email
    await sendVerificationEmail(
      normalizedEmail,
      normalizedName,
      verificationCode,
    );

    res.status(201).json({
      message: "Verification code sent to your email",
      email: normalizedEmail,
    });
  } catch (error) {
    console.error("Signup error:", error.message);

    res.status(500).json({
      error: "Unable to start signup. Please try again.",
    });
  }
});

// Verify email and create account
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

    // Check whether the code has expired
    if (new Date() > new Date(verification.expires_at)) {
      await pool.query("DELETE FROM email_verifications WHERE id = $1", [
        verification.id,
      ]);

      return res.status(400).json({
        error: "Verification code has expired. Please sign up again.",
      });
    }

    // Check whether the code is correct
    if (verification.verification_code !== normalizedCode) {
      return res.status(400).json({
        error: "Invalid verification code",
      });
    }

    // Make sure the email wasn't registered while verification was pending
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail],
    );

    if (existingUser.rows.length > 0) {
      await pool.query("DELETE FROM email_verifications WHERE id = $1", [
        verification.id,
      ]);

      return res.status(409).json({
        error: "Email already exists",
      });
    }

    // Create the real user account
    const result = await pool.query(
      `INSERT INTO users (name, email, password)
             VALUES ($1, $2, $3)
             RETURNING id, name, email, created_at`,
      [verification.name, verification.email, verification.password],
    );

    // Verification completed, so remove the temporary record
    await pool.query("DELETE FROM email_verifications WHERE id = $1", [
      verification.id,
    ]);

    res.status(201).json({
      message: "Email verified and account created successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Email verification error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "Email already exists",
      });
    }

    res.status(500).json({
      error: "Unable to verify email. Please try again.",
    });
  }
});

// Update logged-in user's profile
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
                 RETURNING id, name, email, created_at`,
        [name, email, hashedPassword, req.user.id],
      );
    } else {
      result = await pool.query(
        `UPDATE users
                 SET name = $1, email = $2
                 WHERE id = $3
                 RETURNING id, name, email, created_at`,
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

    if (error.code === "23505") {
      return res.status(409).json({
        error: "Email already exists",
      });
    }

    res.status(500).json({
      error: "Database error",
    });
  }
});

module.exports = router;
