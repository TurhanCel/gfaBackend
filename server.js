const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const mysql = require('mysql2/promise');

const authRoutes = require("./routes/authRoutes");
const contactRoutes = require("./routes/contactRoutes");
const eventRoutes = require("./routes/eventRoutes");
const { createTables } = require("./models/init");
require("dotenv").config();

// Initialize Express app
const app = express();

// Email configuration
if (process.env.EMAIL_PROVIDER === 'gmail') {
    console.log("📧 Configuring email with GMAIL provider");
    console.log("📧 Configuring email with GMAIL provider for contact forms");
}

// Database Connection Pool with simplified options
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 60000 // Only keep this supported option
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for development, enable in production
}));

// Configure CORS
app.use((req, res, next) => {
    console.log('Incoming request origin:', req.get('origin'));
    console.log('Incoming request headers:', req.headers);
    next();
  });
  
  app.use(cors({
    origin: ['https://gfabrussels.com', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
    credentials: true 
}));

app.options('*', cors());
  
// Request parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging middleware
app.use(morgan("dev"));

// Static files middleware (for uploaded files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Initialization
async function initializeDatabase() {
    let connection;
    try {
        // Test database connection
        connection = await pool.getConnection();
        console.log("✅ Database connection successful");
        
        // Simple test query
        await connection.query('SELECT 1');
        console.log("✅ Database query test successful");
        
        connection.release();
        
        // Create tables
        await createTables();
        console.log("✅ Database tables initialized successfully");
    } catch (err) {
        console.error("❌ Database connection failed:", err);
        
        // Check if it's a permissions issue
        if (err.code === 'ER_DBACCESS_DENIED_ERROR') {
            console.error("❗ You need to grant proper permissions to your database user");
            console.error("❗ Run this SQL command on your MySQL server:");
            console.error(`GRANT ALL PRIVILEGES ON ${process.env.DB_NAME}.* TO '${process.env.DB_USER}'@'%';`);
            console.error("FLUSH PRIVILEGES;");
        }
        
        if (connection) {
            connection.release();
        }
        
        // Don't exit so the server can still run for non-database functionality
        console.warn("⚠️ Server will start without database functionality");
    }
}

// API routes
app.use("/api/auth", authRoutes);
app.use("/api", contactRoutes);
app.use("/api/events", eventRoutes);

// Test route
app.get("/api/health", async (req, res) => {
    try {
        // Check database connection in health endpoint
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
        
        res.status(200).json({ 
            status: "UP",
            message: "Server is running",
            database: "Connected",
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || "development"
        });
    } catch (err) {
        res.status(200).json({
            status: "DEGRADED",
            message: "Server is running but database connection failed",
            database: "Disconnected",
            dbError: err.message,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || "development"
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error("🔥 Unhandled Error:", err);
    
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === "production" && statusCode === 500
        ? "Internal server error"
        : err.message || "Something went wrong";
    
    res.status(statusCode).json({
        error: message,
        status: "error"
    });
});

// Handle 404 routes
app.use("*", (req, res) => {
    res.status(404).json({
        error: "Route not found",
        status: "error"
    });
});

// Start the server
const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        // Initialize database before starting server
        await initializeDatabase();

        // Start server
        const server = app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📝 API documentation available at http://localhost:${PORT}/api-docs (if enabled)`);
        });

        // Graceful shutdown handler
        const shutDown = () => {
            console.log("🛑 Received kill signal, shutting down gracefully");
            server.close(() => {
                console.log("🚧 HTTP server closed");
                pool.end(err => {
                    if (err) {
                        console.error("❌ Error closing database connection:", err);
                        process.exit(1);
                    }
                    console.log("✅ Database connection closed");
                    process.exit(0);
                });
            });
        };

        process.on("SIGTERM", shutDown);
        process.on("SIGINT", shutDown);
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
}

// Execute server start
startServer();

// Export for potential testing
module.exports = { app, pool };