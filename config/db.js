const mysql = require("mysql2");

const db = mysql.createPool({
  host: "localhost",
  user: "desubingo",
  password: "12345678", // your MySQL password
  database: "bingo_db",
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
