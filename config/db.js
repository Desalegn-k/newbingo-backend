require("dotenv").config();
const mysql = require("mysql2");

const databaseUrl = new URL(process.env.DATABASE_URL);

const db = mysql.createPool({
  uri: databaseUrl.toString(),
  ssl: {},
});

// db.connect((err) => {
//   if (err) throw err;
//   console.log("✅ MySQL Connected...");
// });

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to MySQL database!");
    connection.release(); // Release the connection back to the pool
  }
});
module.exports = db.promise();
