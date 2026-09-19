const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const projectRoutes = require("./routes/projectRoutes");
const authRoutes = require("./routes/authRoutes");
const teamRoutes = require("./routes/teamRoutes");
const taskRoutes = require("./routes/taskRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const subtaskRoutes = require("./routes/subtaskRoutes");
const milestoneRoutes = require("./routes/milestoneRoutes");
const commentRoutes = require("./routes/commentRoutes");
const resourceRoutes = require("./routes/resourceRoutes");
const express = require("express");

const app = express();

app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
    res.send("Backend is working");
});

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
module.exports = app;