const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

/*
|--------------------------------------------------------------------------
| Load Environment Variables
|--------------------------------------------------------------------------
|
| Priority:
| 1. backend/.env
| 2. project-root .env
|
*/

const backendEnvPath = path.resolve(__dirname, "../.env");
const projectEnvPath = path.resolve(__dirname, "../../.env");

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({
    path: backendEnvPath,
  });
}

if (fs.existsSync(projectEnvPath)) {
  dotenv.config({
    path: projectEnvPath,
  });
}

/*
|--------------------------------------------------------------------------
| Import Application and Database
|--------------------------------------------------------------------------
|
| Load these after environment variables so routes and services
| can access the required configuration.
|
*/

const app = require("./app");
const pool = require("./config/db");

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    await pool.query("SELECT NOW()");
    console.log("PostgreSQL connected");
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
  }
});
