require("dotenv").config();
const app = require("./app");
const pool = require("./config/db");
require("./utils/emailService");

const PORT = 5000;

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    await pool.query("SELECT NOW()");
    console.log("PostgreSQL connected");
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
  }
});
