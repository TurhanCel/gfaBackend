const nodemailer = require("nodemailer");
const db = require("../config/db");
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
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
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
    
    console.log(`📧 Configuring email with ${provider.toUpperCase()} provider for contact forms`);
    return nodemailer.createTransport(config);
};

// Handle Contact Form Submission
exports.submitContactForm = async (req, res) => {
    const { name, email, phone, subject, message, newsletter } = req.body;

    try {
        // Validate required fields
        if (!name || !email || !message) {
            return res.status(400).json({ 
                status: "error",
                error: "Name, email, and message are required fields" 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                status: "error",
                error: "Please provide a valid email address" 
            });
        }

        // Save to database
        await db.promise().query(
            `INSERT INTO contact_messages 
            (name, email, phone, subject, message, newsletter) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                name, 
                email, 
                phone || null, 
                subject || "General Inquiry", 
                message,
                newsletter || false
            ]
        );

        // Send confirmation email to user
        const userMailOptions = {
            from: `"Global Finance Academy" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "We've Received Your Message",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Thank You for Contacting Us!</h2>
                    <p>Dear ${name},</p>
                    <p>We've received your message and will get back to you as soon as possible. Here's a copy of what you sent us:</p>
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Subject:</strong> ${subject || "General Inquiry"}</p>
                        <p><strong>Message:</strong></p>
                        <p>${message}</p>
                    </div>
                    <p>If you have any additional information to share, feel free to reply to this email.</p>
                    <p>Best regards,<br>The GFA Team</p>
                </div>
            `
        };

        // Send notification email to admin
        const adminMailOptions = {
            from: `"Contact Form" <${process.env.EMAIL_USER}>`,
            to: "gfabrussels@gmail.com", // Admin email
            subject: `New Contact Message: ${subject || "General Inquiry"}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>New Contact Form Submission</h2>
                    <p><strong>From:</strong> ${name} (${email})</p>
                    <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
                    <p><strong>Subject:</strong> ${subject || "General Inquiry"}</p>
                    <p><strong>Newsletter:</strong> ${newsletter ? "Yes" : "No"}</p>
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Message:</strong></p>
                        <p>${message}</p>
                    </div>
                </div>
            `
        };

        // Send both emails
        await Promise.all([
            transporter.sendMail(userMailOptions),
            transporter.sendMail(adminMailOptions)
        ]);

        res.status(200).json({ 
            status: "success",
            message: "Your message has been sent successfully!" 
        });
    } catch (error) {
        console.error("🔥 Contact Form Error:", error);
        res.status(500).json({ 
            status: "error",
            error: "Failed to send message. Please try again later." 
        });
    }
};

// Test Email Endpoint
exports.testEmail = async (req, res) => {
    try {
        const testEmail = req.body.email || "your-email@example.com";
        
        const mailOptions = {
            from: `"Global Finance Academy" <${process.env.EMAIL_USER}>`,
            to: testEmail,
            subject: "Test Email from GFA",
            text: "This is a test email from Global Finance Academy.",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Test Email</h2>
                    <p>This is a test email from Global Finance Academy.</p>
                    <p>If you received this, your email configuration is working correctly!</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("✅ Test email sent:", info.response);
        
        res.status(200).json({ 
            status: "success",
            message: "Test email sent successfully!",
            info: {
                messageId: info.messageId,
                response: info.response
            }
        });
    } catch (error) {
        console.error("🔥 Test Email Error:", error);
        res.status(500).json({ 
            status: "error",
            error: "Failed to send test email" 
        });
    }
};

// Newsletter Subscription
exports.subscribeNewsletter = async (req, res) => {
    try {
        const { email, name } = req.body;
        
        // Validate email
        if (!email) {
            return res.status(400).json({ 
                status: "error",
                error: "Email is required" 
            });
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                status: "error",
                error: "Please provide a valid email address" 
            });
        }
        
        // Check if already subscribed
        const [existingSubscriber] = await db.promise().query(
            "SELECT * FROM newsletter_subscribers WHERE email = ?",
            [email]
        );
        
        if (existingSubscriber.length > 0) {
            return res.status(400).json({ 
                status: "error",
                error: "This email is already subscribed to our newsletter" 
            });
        }
        
        // Save to database
        await db.promise().query(
            "INSERT INTO newsletter_subscribers (email, name) VALUES (?, ?)",
            [email, name || null]
        );
        
        // Send confirmation email
        const mailOptions = {
            from: `"Global Finance Academy" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Welcome to Our Newsletter!",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to Our Newsletter!</h2>
                    <p>Dear ${name || "Subscriber"},</p>
                    <p>Thank you for subscribing to the Global Finance Academy newsletter!</p>
                    <p>You'll now receive updates on our latest events, articles, and more.</p>
                    <p>Best regards,<br>The GFA Team</p>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        
        res.status(200).json({ 
            status: "success",
            message: "Successfully subscribed to the newsletter!" 
        });
    } catch (error) {
        console.error("🔥 Newsletter Subscription Error:", error);
        res.status(500).json({ 
            status: "error",
            error: "Failed to subscribe to the newsletter" 
        });
    }
};