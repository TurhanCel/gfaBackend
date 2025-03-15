const db = require("../config/db");

// Get all articles with optional filtering
exports.getArticles = async (req, res) => {
    try {
        let query = "SELECT * FROM articles";
        const queryParams = [];
        
        // Handle filters
        const { category, search, limit } = req.query;
        const whereConditions = [];
        
        if (category) {
            whereConditions.push("category = ?");
            queryParams.push(category);
        }
        
        if (search) {
            whereConditions.push("(title LIKE ? OR content LIKE ?)");
            queryParams.push(`%${search}%`);
            queryParams.push(`%${search}%`);
        }
        
        // Add WHERE clause if filters exist
        if (whereConditions.length > 0) {
            query += " WHERE " + whereConditions.join(" AND ");
        }
        
        // Order by published date
        query += " ORDER BY published_date DESC";
        
        // Add limit if specified
        if (limit && !isNaN(parseInt(limit))) {
            query += " LIMIT ?";
            queryParams.push(parseInt(limit));
        }
        
        const [articles] = await db.promise().query(query, queryParams);
        
        res.status(200).json({ 
            status: "success",
            count: articles.length,
            data: articles 
        });
    } catch (error) {
        console.error("❌ Error fetching articles:", error);
        res.status(500).json({ 
            status: "error",
            error: "Error fetching articles" 
        });
    }
};

// Get a single article by ID
exports.getArticleById = async (req, res) => {
    try {
        const articleId = req.params.id;
        
        if (!articleId || isNaN(parseInt(articleId))) {
            return res.status(400).json({ 
                status: "error",
                error: "Invalid article ID" 
            });
        }
        
        const [articles] = await db.promise().query(
            "SELECT * FROM articles WHERE id = ?", 
            [articleId]
        );
        
        if (articles.length === 0) {
            return res.status(404).json({ 
                status: "error",
                error: "Article not found" 
            });
        }
        
        res.status(200).json({ 
            status: "success",
            data: articles[0] 
        });
    } catch (error) {
        console.error(`❌ Error fetching article ${req.params.id}:`, error);
        res.status(500).json({ 
            status: "error",
            error: "Error fetching article details" 
        });
    }
};

// Create a new article (admin only)
exports.createArticle = async (req, res) => {
    try {
        const { 
            title, 
            content, 
            author,
            image, 
            category
        } = req.body;
        
        // Validate required fields
        if (!title || !content) {
            return res.status(400).json({ 
                status: "error",
                error: "Title and content are required fields" 
            });
        }
        
        const result = await db.promise().query(
            `INSERT INTO articles 
            (title, content, author, image, category) 
            VALUES (?, ?, ?, ?, ?)`,
            [
                title, 
                content, 
                author || null, 
                image || null, 
                category || null
            ]
        );
        
        const newArticleId = result[0].insertId;
        
        res.status(201).json({ 
            status: "success",
            message: "Article created successfully",
            data: { id: newArticleId }
        });
    } catch (error) {
        console.error("❌ Error creating article:", error);
        res.status(500).json({ 
            status: "error",
            error: "Error creating article" 
        });
    }
};

// Update an existing article (admin only)
exports.updateArticle = async (req, res) => {
    try {
        const articleId = req.params.id;
        
        if (!articleId || isNaN(parseInt(articleId))) {
            return res.status(400).json({ 
                status: "error",
                error: "Invalid article ID" 
            });
        }
        
        const { 
            title, 
            content, 
            author,
            image, 
            category
        } = req.body;
        
        // Check if article exists
        const [existingArticle] = await db.promise().query(
            "SELECT * FROM articles WHERE id = ?", 
            [articleId]
        );
        
        if (existingArticle.length === 0) {
            return res.status(404).json({ 
                status: "error",
                error: "Article not found" 
            });
        }
        
        // Update article
        await db.promise().query(
            `UPDATE articles SET 
            title = IFNULL(?, title),
            content = IFNULL(?, content),
            author = IFNULL(?, author),
            image = IFNULL(?, image),
            category = IFNULL(?, category)
            WHERE id = ?`,
            [
                title || null, 
                content || null, 
                author || null, 
                image || null, 
                category || null,
                articleId
            ]
        );
        
        res.status(200).json({ 
            status: "success",
            message: "Article updated successfully"
        });
    } catch (error) {
        console.error(`❌ Error updating article ${req.params.id}:`, error);
        res.status(500).json({ 
            status: "error",
            error: "Error updating article" 
        });
    }
};

// Delete an article (admin only)
exports.deleteArticle = async (req, res) => {
    try {
        const articleId = req.params.id;
        
        if (!articleId || isNaN(parseInt(articleId))) {
            return res.status(400).json({ 
                status: "error",
                error: "Invalid article ID" 
            });
        }
        
        // Check if article exists
        const [existingArticle] = await db.promise().query(
            "SELECT * FROM articles WHERE id = ?", 
            [articleId]
        );
        
        if (existingArticle.length === 0) {
            return res.status(404).json({ 
                status: "error",
                error: "Article not found" 
            });
        }
        
        // Delete article
        await db.promise().query(
            "DELETE FROM articles WHERE id = ?",
            [articleId]
        );
        
        res.status(200).json({ 
            status: "success",
            message: "Article deleted successfully"
        });
    } catch (error) {
        console.error(`❌ Error deleting article ${req.params.id}:`, error);
        res.status(500).json({ 
            status: "error",
            error: "Error deleting article" 
        });
    }
};