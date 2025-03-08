const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const authenticateUser = require("../middleware/authMiddleWare");
const { 
    register, 
    login, 
    logout, 
    verifyToken,
    forgotPassword, 
    resetPassword,
    getUserProfile,
    updateUserProfile,
    changePassword,
    uploadProfilePicture,
    deleteAccount,
    getDashboardData
} = require("../controllers/authController");

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create profile-pics subdirectory if it doesn't exist
        const uploadDir = path.join(__dirname, "../uploads/profile-pics");
        
        // Ensure the upload directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Use user ID and timestamp for unique filename
        const userId = req.user.id;
        const fileExt = path.extname(file.originalname).toLowerCase();
        const fileName = `user_${userId}_${Date.now()}${fileExt}`;
        cb(null, fileName);
    }
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, GIF, and WEBP are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: fileFilter
});

// Profile picture upload route
router.post('/profile-picture', authenticateUser, upload.single('profilePic'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.user.id;
        
        // Get the file path relative to the server (for database storage)
        const fileRelativePath = `/uploads/profile-pics/${req.file.filename}`;
        
        // Get current profile picture path from database to delete old one
        const [rows] = await db.query(
            'SELECT profile_pic FROM users WHERE id = ?', 
            [userId]
        );
        
        if (rows.length > 0) {
            const oldPicPath = rows[0].profile_pic;
            
            // Delete old profile picture if it exists and isn't the default
            if (oldPicPath && !oldPicPath.includes('default') && fs.existsSync(path.join(__dirname, '..', oldPicPath))) {
                fs.unlinkSync(path.join(__dirname, '..', oldPicPath));
            }
        }
        
        // Update user profile picture in database
        await db.query(
            'UPDATE users SET profile_pic = ? WHERE id = ?',
            [fileRelativePath, userId]
        );
        
        // Return the profile picture URL
        res.status(200).json({
            message: 'Profile picture updated successfully',
            profilePicUrl: fileRelativePath
        });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 2MB.' });
        }
        
        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});




// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/verify", verifyToken);

// Protected routes - require authentication
router.get("/profile", authenticateUser, getUserProfile);
router.put("/profile", authenticateUser, updateUserProfile);
router.post("/change-password", authenticateUser, changePassword);
router.post('/upload-profile-pic', authenticateUser, upload.single('profile_pic'), uploadProfilePicture);
router.delete("/account", authenticateUser, deleteAccount);
router.get("/dashboard", authenticateUser, getDashboardData);

module.exports = router;