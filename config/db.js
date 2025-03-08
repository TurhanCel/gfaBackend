const mysql = require("mysql2");
require("dotenv").config();

// ✅ Create a connection pool (better scalability)
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, // ✅ Allows 10 concurrent connections
    queueLimit: 0, // ✅ Prevents query failures if limit is reached
});

// ✅ Test the database connection
db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Database connection failed:", err);
        return;
    }
    console.log("✅ Connected to MySQL!");
    connection.release(); // ✅ Release the connection after testing
});

module.exports = db;
