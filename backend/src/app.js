const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const path = require("path");

// Core routes
const userRoutes = require("./routes/userRoutes");
const projectRoutes = require("./routes/projectRoutes");
const authRoutes = require("./routes/authRoutes");
const teamRoutes = require("./routes/teamRoutes");
const taskRoutes = require("./routes/taskRoutes");
const subtaskRoutes = require("./routes/subtaskRoutes");
const milestoneRoutes = require("./routes/milestoneRoutes");
const commentRoutes = require("./routes/commentRoutes");
const resourceRoutes = require("./routes/resourceRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

// Company workspace routes
const workspaceRoutes = require("./routes/workspaceRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const projectActivityRoutes = require("./routes/projectActivityRoutes");
const organizationAnalyticsRoutes = require("./routes/organizationAnalyticsRoutes");

// AI routes
const aiContextRoutes = require("./routes/aiContextRoutes");
const aiChatRoutes = require("./routes/aiChatRoutes");
const aiConversationRoutes = require("./routes/aiConversationRoutes");
const aiConfirmationRoutes = require("./routes/aiConfirmationRoutes");

const app = express();

// Hide Express framework identification.
app.disable("x-powered-by");

// Add HTTP security headers using Helmet.
app.use(
  helmet({
    strictTransportSecurity:
      process.env.NODE_ENV === "production" ? undefined : false,
  }),
);

// Configure allowed frontend origins.
const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const developmentOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

const allowedOrigins = configuredOrigins.length
  ? configuredOrigins
  : process.env.NODE_ENV === "production"
    ? []
    : developmentOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
  }),
);

app.use(express.json());

// Serve uploaded resource files.
app.use(
  "/uploads",
  helmet.crossOriginResourcePolicy({
    policy: "cross-origin",
  }),
  express.static(path.join(__dirname, "../uploads")),
);

// Backend health check.
app.get("/", (req, res) => {
  res.send("Backend is working");
});

// Core application routes.
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/subtasks", subtaskRoutes);
app.use("/api/milestones", milestoneRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/resources", resourceRoutes);

// Company workspace routes.
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/project-activities", projectActivityRoutes);
app.use("/api/organization-analytics", organizationAnalyticsRoutes);

// AI context and chat routes.
app.use("/api/ai/context", aiContextRoutes);
app.use("/api/ai/chat", aiChatRoutes);
app.use("/api/ai/conversations", aiConversationRoutes);
app.use("/api/ai/confirm", aiConfirmationRoutes);

module.exports = app;
