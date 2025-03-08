const jwt = require("jsonwebtoken");

const authenticateUser = (req, res, next) => {
    let token = req.cookies.token || req.headers.authorization; // ✅ Try getting token from cookie first, then from headers

    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    if (token.startsWith("Bearer ")) {
        token = token.slice(7, token.length); // ✅ Remove 'Bearer ' from token if it exists
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // ✅ Store user data in request object
        next(); // ✅ Continue to next middleware
    } catch (err) {
        res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
};

module.exports = authenticateUser;
