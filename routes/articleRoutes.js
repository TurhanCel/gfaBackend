const express = require("express");
const { 
    getArticles, 
    getArticleById, 
    createArticle, 
    updateArticle, 
    deleteArticle
} = require("../controllers/articleController");
const authenticateUser = require("../middleware/authMiddleWare");

const router = express.Router();

// Public routes
router.get("/", getArticles);
router.get("/:id", getArticleById);

// Protected routes - require authentication
router.post("/", authenticateUser, createArticle);
router.put("/:id", authenticateUser, updateArticle);
router.delete("/:id", authenticateUser, deleteArticle);

module.exports = router;