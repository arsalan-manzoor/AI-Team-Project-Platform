const userRoutes = require("./routes/userRoutes");
const projectRoutes = require("./routes/projectRoutes");
const authRoutes = require("./routes/authRoutes");
const teamRoutes = require("./routes/teamRoutes");
const taskRoutes = require("./routes/taskRoutes");
const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Backend is working");
});

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
module.exports = app;