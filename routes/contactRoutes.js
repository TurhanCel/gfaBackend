const express = require("express");
const { submitContactForm, testEmail, subscribeNewsletter } = require("../controllers/contactController");

const router = express.Router();

// Contact form submission
router.post("/contact", submitContactForm);
router.post("/contact/", submitContactForm);

// Newsletter subscription
router.post("/newsletter", subscribeNewsletter);

// Test email route (for development)
router.post("/test-email", testEmail);

module.exports = router;