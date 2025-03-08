const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../config/db");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
require("dotenv").config();

// Configure mail transporter based on environment
const getMailTransporter = () => {
    const provider = process.env.EMAIL_PROVIDER || "gmail";
    
    let config;
    
    if (provider === "gmail") {
        config = {
            host: process.env.GMAIL_SMTP_HOST,
            port: process.env.GMAIL_SMTP_PORT,
            secure: true,
            auth: {
                user: process.env.GMAIL_EMAIL_USER,
                pass: process.env.GMAIL_EMAIL_PASS
            }
        };
    } else if (provider === "hostinger") {
        config = {
            host: "smtp.hostinger.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            // Add these settings to improve connection reliability
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 60000,
            greetingTimeout: 30000
        };
    } else {
        // Default or other provider
        config = {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_PORT === "465",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        };
    }
    
    console.log(`📧 Configuring email with ${provider.toUpperCase()} provider`);
    return nodemailer.createTransport(config);
};

const transporter = getMailTransporter();

// Test SMTP Connection
transporter.verify((error, success) => {
    if (error) {
        console.error("🚨 SMTP Connection Error:", error);
    } else {
        console.log("✅ SMTP Server is Ready to Send Emails");
    }
});

// Helper function to generate JWT token
const generateToken = (userId, email) => {
    return jwt.sign(
        { id: userId, email }, 
        process.env.JWT_SECRET, 
        { expiresIn: "24h" }
    );
};

// REGISTER USER
exports.register = async (req, res) => {
    console.log('------- Registration Request -------');
    console.log('Request Body:', req.body);
    console.log('Request Headers:', req.headers);

    const { name, email, password } = req.body;

    try {
        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ 
                status: "error",
                error: "All fields are required" 
            });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ 
                status: "error",
                error: "Password must be at least 8 characters long" 
            });
        }

        // Check if user already exists
        const [existingUser] = await db.promise().query(
            "SELECT email FROM users WHERE email = ?", 
            [email]
        );
        
        if (existingUser.length > 0) {
            return res.status(400).json({ 
                status: "error",
                error: "User already exists" 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Insert new user
        const [result] = await db.promise().query(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)", 
            [name, email, hashedPassword]
        );
        
        // Generate token
        const token = generateToken(result.insertId, email);
        
        // Store token in database
        await db.promise().query(
            "UPDATE users SET session_token = ? WHERE id = ?", 
            [token, result.insertId]
        );
        
        // Send welcome email
        try {
            await transporter.sendMail({
                from: `"Global Finance Academy" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: "Welcome to Global Finance Academy",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Welcome to Global Finance Academy!</h2>
                        <p>Dear ${name},</p>
                        <p>Thank you for registering with Global Finance Academy. We're excited to have you join our community!</p>
                        <p>You now have access to all member features including:</p>
                        <ul>
                            <li>Exclusive events and workshops</li>
                            <li>Job opportunities in finance</li>
                            <li>Networking with industry professionals</li>
                        </ul>
                        <p>Get started by exploring our <a href="${process.env.FRONTEND_URL || 'http://127.0.0.1:5500'}/events.html">upcoming events</a>.</p>
                        <p>Best regards,<br>The GFA Team</p>
                    </div>
                `
            });
            console.log("✅ Welcome email sent to", email);
        } catch (emailError) {
            console.error("❌ Error sending welcome email:", emailError);
            // Non-blocking: continue without email
        }

        res.status(201).json({ 
            status: "success",
            message: "User registered successfully!",
            token
        });
    } catch (err) {
        console.error("❌ Registration Error:", err);
        res.status(500).json({ 
            status: "error",
            error: "Server error during registration" 
        });
    }
};

// LOGIN USER
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Validate input
        if (!email || !password) {
            return res.status(400).json({ 
                status: "error",
                error: "Email and password are required" 
            });
        }

        // Get user from database
        const [users] = await db.promise().query(
            "SELECT * FROM users WHERE email = ?", 
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ 
                status: "error",
                error: "Invalid email or password" 
            });
        }

        const user = users[0];
        
        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ 
                status: "error",
                error: "Invalid email or password" 
            });
        }

        // Generate token
        const token = generateToken(user.id, user.email);
        
        // Update last login and store token
        await db.promise().query(
            "UPDATE users SET last_login = NOW(), session_token = ? WHERE id = ?", 
            [token, user.id]
        );

        res.status(200).json({
            status: "success",
            message: "Login successful",
            token
        });
    } catch (error) {
        console.error("🔥 Login Error:", error);
        res.status(500).json({ 
            status: "error",
            error: "Server error during login" 
        });
    }
};

// LOGOUT USER
exports.logout = async (req, res) => {
    try {
        // Get token from header
        const token = req.headers.authorization?.split(" ")[1];
        
        if (token) {
            // Invalidate token in database
            await db.promise().query(
                "UPDATE users SET session_token = NULL WHERE session_token = ?", 
                [token]
            );
        }
        
        res.status(200).json({ 
            status: "success",
            message: "Logout successful" 
        });
    } catch (error) {
        console.error("🔥 Logout Error:", error);
        res.status(500).json({ 
            status: "error",
            error: "Server error during logout" 
        });
    }
};

// VERIFY TOKEN
exports.verifyToken = async (req, res) => {
    try {
        // Get token from header
        const token = req.headers.authorization?.split(" ")[1];
        
        if (!token) {
            return res.status(401).json({ 
                status: "error",
                error: "No token provided" 
            });
        }
        
        // Check token in database
        const [users] = await db.promise().query(
            "SELECT id, email FROM users WHERE session_token = ?", 
            [token]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ 
                status: "error",
                error: "Invalid or expired token" 
            });
        }
        
        // Verify JWT
        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
            // Token is invalid or expired
            console.error("🔥 JWT Verification Error:", jwtError);
            
            // Invalidate token in database
            await db.promise().query(
                "UPDATE users SET session_token = NULL WHERE session_token = ?", 
                [token]
            );
            
            return res.status(401).json({ 
                status: "error",
                error: "Invalid or expired token" 
            });
        }
        
        res.status(200).json({ 
            status: "success",
            message: "Token is valid" 
        });
    } catch (error) {
        console.error("🔥 Token Verification Error:", error);
        res.status(500).json({ 
            status: "error",
            error: "Server error during token verification" 
        });
    }
};

// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        // Validate input
        if (!email) {
            return res.status(400).json({ 
                status: "error",
                error: "Email is required" 
            });
        }

        // Check if user exists
        const [users] = await db.promise().query(
            "SELECT * FROM users WHERE email = ?", 
            [email]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                status: "error",
                error: "User not found" 
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Store token in database
        await db.promise().query(
            "UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?",
            [resetToken, resetTokenExpiry, email]
        );

        // Generate reset link
        const frontendUrl = process.env.FRONTEND_URL || "http://127.0.0.1:5500";
        const resetLink = `${frontendUrl}/reset-password.html?token=${resetToken}`;
        
        // Send email
        await transporter.sendMail({
            from: `"Global Finance Academy" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Password Reset Request",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Password Reset Request</h2>
                    <p>You requested a password reset for your Global Finance Academy account.</p>
                    <p>Click the button below to reset your password. This link expires in 15 minutes.</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                    </p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <p>Best regards,<br>The GFA Team</p>
                </div>
            `
        });

        res.status(200).json({ 
            status: "success",
            message: "Password reset email sent. Check your inbox!" 
        });
    } catch (error) {
        console.error("🔥 Forgot Password Error:", error);
        res.status(500).json({ 
            status: "error",
            error: "Server error while sending email" 
        });
    }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        // Validate input
        if (!token || !newPassword) {
            return res.status(400).json({ 
                status: "error",
                error: "Token and new password are required" 
            });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({ 
                status: "error",
                error: "Password must be at least 8 characters long" 
            });
        }

        // Get user with valid reset token
        const [users] = await db.promise().query(
            "SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()",
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ 
                status: "error",
                error: "Invalid or expired reset token" 
            });
        }

        const user = users[0];
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password and clear reset token
        await db.promise().query(
            "UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
            [hashedPassword, user.id]
        );

        // Invalidate all existing sessions
        await db.promise().query(
            "UPDATE users SET session_token = NULL WHERE id = ?",
            [user.id]
        );

        res.status(200).json({ 
            status: "success",
            message: "Password reset successful. You can now log in!" 
        });
    } catch (error) {
        console.error("🔥 Reset Password Error:", error);
        res.status(500).json({ 
            status: "error",
            error: "Server error during password reset" 
        });
    }
};

// GET USER PROFILE
exports.getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const [users] = await db.promise().query(
            "SELECT id, name, email, profile_pic, phone, birthday, bio, last_login, profile_completion FROM users WHERE id = ?",
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ 
                status: "error",
                error: "User not found" 
            });
        }

        const user = users[0];
        
        // Get user stats
        const [savedJobs] = await db.promise().query(
            "SELECT COUNT(*) as count FROM saved_jobs WHERE user_id = ?",
            [userId]
        );
        
        const [upcomingEvents] = await db.promise().query(
            "SELECT COUNT(*) as count FROM event_registrations er JOIN events e ON er.event_id = e.id WHERE er.user_id = ? AND e.date >= CURDATE()",
            [userId]
        );

        user.savedJobs = savedJobs[0].count;
        user.upcomingEvents = upcomingEvents[0].count;

        res.status(200).json({ 
            status: "success",
            user 
        });
    } catch (error) {
        console.error("🔥 Get User Profile Error:", error);
        res.status(500).json({ 
            status: "error",
            error: "Server error while fetching user profile" 
        });
    }
};

// In authController.js - Update the updateUserProfile function
exports.updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, phone, birthday, bio } = req.body;
        
        console.log('Received birthday:', birthday); // Debug log
        
        // Format the date properly for MySQL if it exists
        let formattedBirthday = null;
        if (birthday && birthday.trim() !== '') {
            formattedBirthday = birthday; // MySQL can handle ISO date format YYYY-MM-DD directly
        }
        
        // Update profile
        await db.promise().query(
            `UPDATE users SET 
            name = IFNULL(?, name),
            phone = IFNULL(?, phone),
            birthday = ?,
            bio = IFNULL(?, bio)
            WHERE id = ?`,
            [
                name || null,
                phone || null,
                formattedBirthday, // Use the formatted date or null
                bio || null,
                userId
            ]
        );
        
        // Recalculate profile completion
        const profileFields = [name, phone, formattedBirthday, bio];
        const completedFields = profileFields.filter(field => field).length;
        const completionPercentage = Math.min(30 + (completedFields * 15), 100);
        
        await db.promise().query(
            "UPDATE users SET profile_completion = ? WHERE id = ?",
            [completionPercentage, userId]
        );

        res.status(200).json({ 
            status: "success",
            message: "Profile updated successfully",
            profile_completion: completionPercentage
        });
    } catch (error) {
        console.error("🔥 Update User Profile Error:", error);
        res.status(500).json({ 
            status: "error",
            error: "Server error while updating profile" 
        });
    }
};
  

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                status: "error",
                error: "Current password and new password are required" 
            });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({ 
                status: "error",
                error: "New password must be at least 8 characters long" 
            });
        }

        // Get user from database
        const [users] = await db.promise().query(
            "SELECT * FROM users WHERE id = ?", 
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                status: "error",
                error: "User not found" 
            });
        }

        const user = users[0];
        
        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ 
                status: "error",
                error: "Current password is incorrect" 
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        await db.promise().query(
            "UPDATE users SET password = ? WHERE id = ?",
            [hashedPassword, userId]
        );

        res.status(200).json({ 
            status: "success",
            message: "Password changed successfully" 
        });
    } catch (error) {
        console.error("🔥 Change Password Error:", error);
        res.status(500).json({ 
            status: "error",
            error: "Server error while changing password" 
        });
    }
};

// UPLOAD PROFILE PICTURE
exports.uploadProfilePicture = async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (!req.file) {
            return res.status(400).json({ 
                status: "error",
                error: "No file uploaded" 
            });
        }

        // Validate file type
        const fileTypes = /jpeg|jpg|png|gif/;
        const mimeType = fileTypes.test(req.file.mimetype);
        const extname = fileTypes.test(path.extname(req.file.originalname).toLowerCase());
        
        if (!mimeType || !extname) {
            // Delete temporary file
            await promisify(fs.unlink)(req.file.path);
            
            return res.status(400).json({ 
                status: "error",
                error: "Only JPEG, JPG, PNG, and GIF files are allowed" 
            });
        }

        // Get user to check if they already have a profile picture
        const [users] = await db.promise().query(
            "SELECT profile_pic FROM users WHERE id = ?", 
            [userId]
        );
        
        if (users.length === 0) {
            // Delete temporary file
            await promisify(fs.unlink)(req.file.path);
            
            return res.status(404).json({ 
                status: "error",
                error: "User not found" 
            });
        }

        const user = users[0];
        
        // Delete old profile picture if it exists
        if (user.profile_pic) {
            const oldPicPath = path.join(__dirname, "../uploads", user.profile_pic);
            
            try {
                await promisify(fs.access)(oldPicPath, fs.constants.F_OK);
                await promisify(fs.unlink)(oldPicPath);
            } catch (fileError) {
                // File doesn't exist, ignore
                console.log("Previous profile picture not found:", oldPicPath);
            }
        }

        // Update user profile with new picture path
        const profilePicPath = req.file.filename;
        
        await db.promise().query(
            "UPDATE users SET profile_pic = ? WHERE id = ?",
            [profilePicPath, userId]
        );
        
        // Update profile completion if needed
        if (!user.profile_pic) {
            await db.promise().query(
                "UPDATE users SET profile_completion = LEAST(profile_completion + 10, 100) WHERE id = ?",
                [userId]
            );
        }

        res.status(200).json({ 
            status: "success",
            message: "Profile picture uploaded successfully",
            profile_pic: `/uploads/${profilePicPath}`
        });
    } catch (error) {
        console.error("🔥 Upload Profile Picture Error:", error);
        
        // Delete temporary file if it exists
        if (req.file?.path) {
            try {
                await promisify(fs.unlink)(req.file.path);
            } catch (fileError) {
                console.error("Error deleting temporary file:", fileError);
            }
        }
        
        res.status(500).json({ 
            status: "error",
            error: "Server error while uploading profile picture" 
        });
    }
};

// DELETE ACCOUNT
exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Start transaction
        await db.promise().query("START TRANSACTION");
        
        // Get user profile picture before deletion
        const [users] = await db.promise().query(
            "SELECT profile_pic FROM users WHERE id = ?", 
            [userId]
        );
        
        if (users.length === 0) {
            await db.promise().query("ROLLBACK");
            
            return res.status(404).json({ 
                status: "error",
                error: "User not found" 
            });
        }

        const user = users[0];
        
        // Delete user's event registrations
        await db.promise().query(
            "DELETE FROM event_registrations WHERE user_id = ?",
            [userId]
        );
        
        // Delete user's saved jobs
        await db.promise().query(
            "DELETE FROM saved_jobs WHERE user_id = ?",
            [userId]
        );
        
        // Delete user
        await db.promise().query(
            "DELETE FROM users WHERE id = ?",
            [userId]
        );
        
        // Commit transaction
        await db.promise().query("COMMIT");
        
        // Delete profile picture if it exists
        if (user.profile_pic) {
            const picPath = path.join(__dirname, "../uploads", user.profile_pic);
            
            try {
                await promisify(fs.access)(picPath, fs.constants.F_OK);
                await promisify(fs.unlink)(picPath);
            } catch (fileError) {
                // File doesn't exist, ignore
                console.log("Profile picture not found during account deletion:", picPath);
            }
        }

        res.status(200).json({ 
            status: "success",
            message: "Account deleted successfully" 
        });
    } catch (error) {
        // Rollback transaction in case of error
        await db.promise().query("ROLLBACK");
        
        console.error("🔥 Delete Account Error:", error);
        res.status(500).json({ 
            status: "error",
            error: "Server error while deleting account" 
        });
    }
};

// DASHBOARD DATA
exports.getDashboardData = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user profile data
        const [users] = await db.promise().query(
            "SELECT id, name, email, profile_pic, phone, birthday, bio, last_login, profile_completion FROM users WHERE id = ?",
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                status: "error",
                error: "User not found" 
            });
        }

        const user = users[0];
        
        // Get user stats
        const [savedJobs] = await db.promise().query(
            "SELECT COUNT(*) as count FROM saved_jobs WHERE user_id = ?",
            [userId]
        );
        
        const [upcomingEvents] = await db.promise().query(
            "SELECT COUNT(*) as count FROM event_registrations er JOIN events e ON er.event_id = e.id WHERE er.user_id = ? AND e.date >= CURDATE()",
            [userId]
        );
        
        // Get upcoming events
        const [events] = await db.promise().query(
            `SELECT e.id, e.title, e.date, e.location, e.image, er.registration_date
            FROM events e
            JOIN event_registrations er ON e.id = er.event_id
            WHERE er.user_id = ? AND e.date >= CURDATE()
            ORDER BY e.date ASC
            LIMIT 3`,
            [userId]
        );
        
        // Get saved jobs
        const [jobs] = await db.promise().query(
            `SELECT j.id, j.title, j.company, j.location, sj.saved_date
            FROM jobs j
            JOIN saved_jobs sj ON j.id = sj.job_id
            WHERE sj.user_id = ?
            ORDER BY sj.saved_date DESC
            LIMIT 3`,
            [userId]
        );
        
        // Get recent articles
        const [articles] = await db.promise().query(
            `SELECT id, title, image, published_date
            FROM articles
            ORDER BY published_date DESC
            LIMIT 3`
        );

        // Combine all data
        const dashboardData = {
            user: {
                ...user,
                savedJobs: savedJobs[0].count,
                upcomingEvents: upcomingEvents[0].count
            },
            events,
            jobs,
            articles
        };

        res.status(200).json({ 
            status: "success",
            data: dashboardData 
        });
    } catch (error) {
        console.error("🔥 Dashboard Data Error:", error);
        res.status(500).json({ 
            status: "error",
            error: "Server error while fetching dashboard data" 
        });
    }
};