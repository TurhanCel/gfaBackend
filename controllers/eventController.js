const db = require("../config/db");
const authenticateUser = require("../middleware/authMiddleWare");

// Get all events with optional filtering
exports.getEvents = async (req, res) => {
    try {
        let query = "SELECT * FROM events";
        const queryParams = [];
        
        // Handle filters
        const { category, featured, limit } = req.query;
        const whereConditions = [];
        
        if (category) {
            whereConditions.push("category = ?");
            queryParams.push(category);
        }
        
        if (featured === 'true') {
            whereConditions.push("featured = TRUE");
        }
        
        // Add WHERE clause if filters exist
        if (whereConditions.length > 0) {
            query += " WHERE " + whereConditions.join(" AND ");
        }
        
        // Order by date
        query += " ORDER BY date ASC";
        
        // Add limit if specified
        if (limit && !isNaN(parseInt(limit))) {
            query += " LIMIT ?";
            queryParams.push(parseInt(limit));
        }
        
        const [events] = await db.promise().query(query, queryParams);
        
        res.status(200).json({ 
            status: "success",
            count: events.length,
            data: events 
        });
    } catch (error) {
        console.error("❌ Error fetching events:", error);
        res.status(500).json({ 
            status: "error",
            error: "Error fetching events" 
        });
    }
};

// Get a single event by ID
exports.getEventById = async (req, res) => {
    try {
        const eventId = req.params.id;
        
        if (!eventId || isNaN(parseInt(eventId))) {
            return res.status(400).json({ 
                status: "error",
                error: "Invalid event ID" 
            });
        }
        
        const [events] = await db.promise().query(
            "SELECT * FROM events WHERE id = ?", 
            [eventId]
        );
        
        if (events.length === 0) {
            return res.status(404).json({ 
                status: "error",
                error: "Event not found" 
            });
        }
        
        res.status(200).json({ 
            status: "success",
            data: events[0] 
        });
    } catch (error) {
        console.error(`❌ Error fetching event ${req.params.id}:`, error);
        res.status(500).json({ 
            status: "error",
            error: "Error fetching event details" 
        });
    }
};

// Create a new event (admin only in a real app)
exports.createEvent = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            date,
            time, 
            location, 
            image, 
            seats, 
            category,
            featured 
        } = req.body;
        
        // Validate required fields
        if (!title || !date || !location) {
            return res.status(400).json({ 
                status: "error",
                error: "Title, date, and location are required fields" 
            });
        }
        
        const result = await db.promise().query(
            `INSERT INTO events 
            (title, description, date, time, location, image, seats, category, featured) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title, 
                description, 
                date, 
                time || "12:00:00", 
                location, 
                image || null, 
                seats || 100, 
                category || null, 
                featured || false
            ]
        );
        
        const newEventId = result[0].insertId;
        
        res.status(201).json({ 
            status: "success",
            message: "Event created successfully",
            data: { id: newEventId }
        });
    } catch (error) {
        console.error("❌ Error creating event:", error);
        res.status(500).json({ 
            status: "error",
            error: "Error creating event" 
        });
    }
};

// Update an existing event (admin only in a real app)
exports.updateEvent = async (req, res) => {
    try {
        const eventId = req.params.id;
        
        if (!eventId || isNaN(parseInt(eventId))) {
            return res.status(400).json({ 
                status: "error",
                error: "Invalid event ID" 
            });
        }
        
        const { 
            title, 
            description, 
            date,
            time, 
            location, 
            image, 
            seats, 
            registered,
            category,
            featured 
        } = req.body;
        
        // Check if event exists
        const [existingEvent] = await db.promise().query(
            "SELECT * FROM events WHERE id = ?", 
            [eventId]
        );
        
        if (existingEvent.length === 0) {
            return res.status(404).json({ 
                status: "error",
                error: "Event not found" 
            });
        }
        
        // Update event
        await db.promise().query(
            `UPDATE events SET 
            title = IFNULL(?, title),
            description = IFNULL(?, description),
            date = IFNULL(?, date),
            time = IFNULL(?, time),
            location = IFNULL(?, location),
            image = IFNULL(?, image),
            seats = IFNULL(?, seats),
            registered = IFNULL(?, registered),
            category = IFNULL(?, category),
            featured = IFNULL(?, featured)
            WHERE id = ?`,
            [
                title || null, 
                description || null, 
                date || null, 
                time || null, 
                location || null, 
                image || null, 
                seats || null, 
                registered || null, 
                category || null, 
                featured !== undefined ? featured : null,
                eventId
            ]
        );
        
        res.status(200).json({ 
            status: "success",
            message: "Event updated successfully"
        });
    } catch (error) {
        console.error(`❌ Error updating event ${req.params.id}:`, error);
        res.status(500).json({ 
            status: "error",
            error: "Error updating event" 
        });
    }
};

// Delete an event (admin only in a real app)
exports.deleteEvent = async (req, res) => {
    try {
        const eventId = req.params.id;
        
        if (!eventId || isNaN(parseInt(eventId))) {
            return res.status(400).json({ 
                status: "error",
                error: "Invalid event ID" 
            });
        }
        
        // Check if event exists
        const [existingEvent] = await db.promise().query(
            "SELECT * FROM events WHERE id = ?", 
            [eventId]
        );
        
        if (existingEvent.length === 0) {
            return res.status(404).json({ 
                status: "error",
                error: "Event not found" 
            });
        }
        
        // Delete event
        await db.promise().query(
            "DELETE FROM events WHERE id = ?",
            [eventId]
        );
        
        res.status(200).json({ 
            status: "success",
            message: "Event deleted successfully"
        });
    } catch (error) {
        console.error(`❌ Error deleting event ${req.params.id}:`, error);
        res.status(500).json({ 
            status: "error",
            error: "Error deleting event" 
        });
    }
};

// Register for an event (authenticated users only)
exports.registerForEvent = async (req, res) => {
    try {
        // This route should be protected with authenticateUser middleware
        const userId = req.user.id;
        const eventId = req.params.id;
        
        if (!eventId || isNaN(parseInt(eventId))) {
            return res.status(400).json({ 
                status: "error",
                error: "Invalid event ID" 
            });
        }
        
        // Check if event exists and has available seats
        const [events] = await db.promise().query(
            "SELECT * FROM events WHERE id = ?", 
            [eventId]
        );
        
        if (events.length === 0) {
            return res.status(404).json({ 
                status: "error",
                error: "Event not found" 
            });
        }
        
        const event = events[0];
        
        // Check if user is already registered
        const [existingRegistrations] = await db.promise().query(
            "SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?", 
            [eventId, userId]
        );
        
        if (existingRegistrations.length > 0) {
            return res.status(400).json({ 
                status: "error",
                error: "You are already registered for this event" 
            });
        }
        
        // Check if event is full
        if (event.registered >= event.seats) {
            return res.status(400).json({ 
                status: "error",
                error: "This event is fully booked" 
            });
        }
        
        // Start a transaction
        await db.promise().query("START TRANSACTION");
        
        // Create registration
        await db.promise().query(
            "INSERT INTO event_registrations (event_id, user_id) VALUES (?, ?)",
            [eventId, userId]
        );
        
        // Update registered count
        await db.promise().query(
            "UPDATE events SET registered = registered + 1 WHERE id = ?",
            [eventId]
        );
        
        // Commit transaction
        await db.promise().query("COMMIT");
        
        res.status(201).json({ 
            status: "success",
            message: "Successfully registered for the event"
        });
    } catch (error) {
        // Rollback transaction in case of error
        await db.promise().query("ROLLBACK");
        
        console.error(`❌ Error registering for event ${req.params.id}:`, error);
        res.status(500).json({ 
            status: "error",
            error: "Error registering for event" 
        });
    }
};

// Cancel registration for an event (authenticated users only)
exports.cancelRegistration = async (req, res) => {
    try {
        // This route should be protected with authenticateUser middleware
        const userId = req.user.id;
        const eventId = req.params.id;
        
        if (!eventId || isNaN(parseInt(eventId))) {
            return res.status(400).json({ 
                status: "error",
                error: "Invalid event ID" 
            });
        }
        
        // Check if registration exists
        const [registrations] = await db.promise().query(
            "SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?", 
            [eventId, userId]
        );
        
        if (registrations.length === 0) {
            return res.status(404).json({ 
                status: "error",
                error: "Registration not found" 
            });
        }
        
        // Start a transaction
        await db.promise().query("START TRANSACTION");
        
        // Delete registration
        await db.promise().query(
            "DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?",
            [eventId, userId]
        );
        
        // Update registered count
        await db.promise().query(
            "UPDATE events SET registered = registered - 1 WHERE id = ?",
            [eventId]
        );
        
        // Commit transaction
        await db.promise().query("COMMIT");
        
        res.status(200).json({ 
            status: "success",
            message: "Registration cancelled successfully"
        });
    } catch (error) {
        // Rollback transaction in case of error
        await db.promise().query("ROLLBACK");
        
        console.error(`❌ Error cancelling registration for event ${req.params.id}:`, error);
        res.status(500).json({ 
            status: "error",
            error: "Error cancelling registration" 
        });
    }
};

// Get all events registered by a user (authenticated users only)
exports.getUserEvents = async (req, res) => {
    try {
        // This route should be protected with authenticateUser middleware
        const userId = req.user.id;
        
        const [registrations] = await db.promise().query(
            `SELECT e.*, er.registration_date, er.status
            FROM events e
            INNER JOIN event_registrations er ON e.id = er.event_id
            WHERE er.user_id = ?
            ORDER BY e.date ASC`,
            [userId]
        );
        
        res.status(200).json({ 
            status: "success",
            count: registrations.length,
            data: registrations 
        });
    } catch (error) {
        console.error("❌ Error fetching user events:", error);
        res.status(500).json({ 
            status: "error",
            error: "Error fetching user events" 
        });
    }
};

// Get featured events
exports.getFeaturedEvents = async (req, res) => {
    try {
        const limit = req.query.limit || 3;
        
        const [events] = await db.promise().query(
            "SELECT * FROM events WHERE featured = TRUE ORDER BY date ASC LIMIT ?", 
            [parseInt(limit)]
        );
        
        res.status(200).json({ 
            status: "success",
            count: events.length,
            data: events 
        });
    } catch (error) {
        console.error("❌ Error fetching featured events:", error);
        res.status(500).json({ 
            status: "error",
            error: "Error fetching featured events" 
        });
    }
};