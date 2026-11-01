const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const cors = require("cors");

/*
|--------------------------------------------------------------------------
| LOAD ENVIRONMENT VARIABLES
|--------------------------------------------------------------------------
|
| Check these locations:
|
| 1. backend/.env
| 2. ai-team-project-platform/.env
|
| This file is expected to be in backend/src/.
|--------------------------------------------------------------------------
*/

const backendEnvPath = path.resolve(__dirname, "../.env");
const projectEnvPath = path.resolve(__dirname, "../../.env");

const backendEnvExists = fs.existsSync(backendEnvPath);
const projectEnvExists = fs.existsSync(projectEnvPath);

if (backendEnvExists) {
  dotenv.config({
    path: backendEnvPath,
  });
}

if (projectEnvExists) {
  dotenv.config({
    path: projectEnvPath,
  });
}

/*
|--------------------------------------------------------------------------
| IMPORT APPLICATION AND DATABASE
|--------------------------------------------------------------------------
|
| Load these after environment variables so routes and services
| can access the required configuration.
|--------------------------------------------------------------------------
*/

const app = require("./app");
app.use(cors()); // Enable CORS for all routes
const pool = require("./config/db");

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

const PORT = 5000;

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    await pool.query("SELECT NOW()");
    console.log("PostgreSQL connected");
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
  }
});
