const express = require("express");
const { 
    getEvents, 
    getEventById, 
    createEvent, 
    updateEvent, 
    deleteEvent, 
    registerForEvent, 
    cancelRegistration, 
    getUserEvents, 
    getFeaturedEvents 
} = require("../controllers/eventController");
const authenticateUser = require("../middleware/authMiddleWare");

const router = express.Router();

// Public routes
router.get("/", getEvents);
router.get("/featured", getFeaturedEvents);
router.get("/:id", getEventById);

// Protected routes - require authentication
router.get("/user/events", authenticateUser, getUserEvents);
router.post("/:id/register", authenticateUser, registerForEvent);
router.delete("/:id/register", authenticateUser, cancelRegistration);

// Admin routes - in a real app, these would be protected with an admin middleware
router.post("/", authenticateUser, createEvent);
router.put("/:id", authenticateUser, updateEvent);
router.delete("/:id", authenticateUser, deleteEvent);

module.exports = router;