const { rateLimit } = require("express-rate-limit");

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const createAuthLimiter = ({
  limit,
  message,
  skipSuccessfulRequests = false,
}) => {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,

    handler: (req, res) => {
      res.status(429).json({
        error: message,
        code: "RATE_LIMIT_EXCEEDED",
      });
    },
  });
};

// Login: maximum 10 failed attempts per 15 minutes.
const loginLimiter = createAuthLimiter({
  limit: 10,
  message: "Too many login attempts. Please try again after 15 minutes.",
  skipSuccessfulRequests: true,
});

// Forgot password: maximum 5 requests per 15 minutes.
// Count all requests, including successful generic responses.
const forgotPasswordLimiter = createAuthLimiter({
  limit: 5,
  message: "Too many password reset requests. Please try again later.",
});

// Reset password: maximum 5 failed attempts per 15 minutes.
const resetPasswordLimiter = createAuthLimiter({
  limit: 5,
  message: "Too many password reset attempts. Please try again later.",
  skipSuccessfulRequests: true,
});

// Google authentication: maximum 10 failed attempts per 15 minutes.
const googleAuthLimiter = createAuthLimiter({
  limit: 10,
  message: "Too many Google authentication attempts. Please try again later.",
  skipSuccessfulRequests: true,
});

// Initial password change: maximum 5 failed attempts per 15 minutes.
const initialPasswordLimiter = createAuthLimiter({
  limit: 5,
  message: "Too many password change attempts. Please try again later.",
  skipSuccessfulRequests: true,
});

module.exports = {
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  googleAuthLimiter,
  initialPasswordLimiter,
};
