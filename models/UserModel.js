const db = require("../config/db");

// Function to create all necessary tables
const createTables = async () => {
    try {
        console.log("🔄 Initializing database tables...");
        
        // Create users table
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                profile_pic VARCHAR(255),
                phone VARCHAR(50),
                birthday DATE,
                bio TEXT,
                session_token TEXT,
                reset_token VARCHAR(255),
                reset_token_expiry DATETIME,
                last_login DATETIME,
                profile_completion INT DEFAULT 30,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        
        // Create events table
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                date DATE NOT NULL,
                time TIME,
                location VARCHAR(255) NOT NULL,
                image VARCHAR(255),
                seats INT DEFAULT 100,
                registered INT DEFAULT 0,
                category VARCHAR(50),
                featured BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        
        // Create event_registrations table
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS event_registrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_id INT NOT NULL,
                user_id INT NOT NULL,
                status VARCHAR(50) DEFAULT 'confirmed',
                registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
        
        // Create articles table
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS articles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                author VARCHAR(255),
                image VARCHAR(255),
                category VARCHAR(50),
                published_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        
        // Create jobs table
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS jobs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                company VARCHAR(255) NOT NULL,
                location VARCHAR(255),
                description TEXT,
                requirements TEXT,
                application_link VARCHAR(255),
                status ENUM('open', 'closed') DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        
        // Create saved_jobs table
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS saved_jobs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                job_id INT NOT NULL,
                user_id INT NOT NULL,
                saved_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY user_job (user_id, job_id)
            );
        `);
        
        // Create contact_messages table
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS contact_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                subject VARCHAR(255),
                message TEXT NOT NULL,
                newsletter BOOLEAN DEFAULT FALSE,
                status ENUM('new', 'read', 'replied') DEFAULT 'new',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log("✅ All tables created successfully");
        
        // Insert sample events if none exist
        const [eventCount] = await db.promise().query("SELECT COUNT(*) as count FROM events");
        
        if (eventCount[0].count === 0) {
            console.log("🔄 Inserting sample events...");
            
            const sampleEvents = [
                {
                    title: "Tech Conference 2025",
                    description: "Join us for a day of technology insights and networking with industry leaders.",
                    date: "2025-03-15",
                    time: "09:00:00",
                    location: "Brussels, Belgium",
                    image: "tech-conference.jpg",
                    seats: 150,
                    registered: 87,
                    category: "technology",
                    featured: true
                },
                {
                    title: "AI Workshop",
                    description: "Learn about the latest AI trends and how they impact the financial industry.",
                    date: "2025-04-10",
                    time: "14:00:00",
                    location: "Amsterdam, Netherlands",
                    image: "ai-workshop.jpg",
                    seats: 50,
                    registered: 32,
                    category: "technology",
                    featured: true
                },
                {
                    title: "Startup Pitch Night",
                    description: "Watch innovative startups pitch their ideas to investors and industry experts.",
                    date: "2025-05-05",
                    time: "18:30:00",
                    location: "Berlin, Germany",
                    image: "startup-pitch-night.jpg",
                    seats: 200,
                    registered: 110,
                    category: "entrepreneurship",
                    featured: true
                }
            ];
            
            for (const event of sampleEvents) {
                await db.promise().query(
                    "INSERT INTO events (title, description, date, time, location, image, seats, registered, category, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [event.title, event.description, event.date, event.time, event.location, event.image, event.seats, event.registered, event.category, event.featured]
                );
            }
            
            console.log("✅ Sample events inserted successfully");
        }
        
        // Insert sample articles if none exist
        const [articleCount] = await db.promise().query("SELECT COUNT(*) as count FROM articles");
        
        if (articleCount[0].count === 0) {
            console.log("🔄 Inserting sample articles...");
            
            const sampleArticles = [
                {
                    title: "Understanding Market Trends",
                    content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget ultricies aliquam, nunc nisl ultricies nunc, vitae ultricies nisl nisl eget nisl.",
                    author: "John Doe",
                    image: "market-trends.jpg",
                    category: "finance"
                },
                {
                    title: "Investing Strategies for 2024",
                    content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget ultricies aliquam, nunc nisl ultricies nunc, vitae ultricies nisl nisl eget nisl.",
                    author: "Jane Smith",
                    image: "investing.jpg",
                    category: "investment"
                },
                {
                    title: "The Rise of FinTech in Banking",
                    content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget ultricies aliquam, nunc nisl ultricies nunc, vitae ultricies nisl nisl eget nisl.",
                    author: "Mike Johnson",
                    image: "fintech.jpg",
                    category: "technology"
                }
            ];
            
            for (const article of sampleArticles) {
                await db.promise().query(
                    "INSERT INTO articles (title, content, author, image, category) VALUES (?, ?, ?, ?, ?)",
                    [article.title, article.content, article.author, article.image, article.category]
                );
            }
            
            console.log("✅ Sample articles inserted successfully");
        }
        
        // Insert sample jobs if none exist
        const [jobCount] = await db.promise().query("SELECT COUNT(*) as count FROM jobs");
        
        if (jobCount[0].count === 0) {
            console.log("🔄 Inserting sample jobs...");
            
            const sampleJobs = [
                {
                    title: "Frontend Developer",
                    company: "TechCorp",
                    location: "Remote",
                    description: "We are looking for an experienced Frontend Developer to join our team.",
                    requirements: "3+ years of experience with React, JavaScript, HTML, CSS",
                    application_link: "https://example.com/apply"
                },
                {
                    title: "Backend Developer",
                    company: "CodeWorks",
                    location: "Brussels, Belgium",
                    description: "Join our backend team to build scalable applications.",
                    requirements: "Experience with Node.js, Express, and MySQL",
                    application_link: "https://example.com/apply"
                },
                {
                    title: "UI/UX Designer",
                    company: "DesignHub",
                    location: "Amsterdam, Netherlands",
                    description: "Create beautiful and intuitive user interfaces for web and mobile applications.",
                    requirements: "Portfolio demonstrating UI/UX design skills",
                    application_link: "https://example.com/apply"
                }
            ];
            
            for (const job of sampleJobs) {
                await db.promise().query(
                    "INSERT INTO jobs (title, company, location, description, requirements, application_link) VALUES (?, ?, ?, ?, ?, ?)",
                    [job.title, job.company, job.location, job.description, job.requirements, job.application_link]
                );
            }
            
            console.log("✅ Sample jobs inserted successfully");
        }
        
        return true;
    } catch (error) {
        console.error("❌ Error creating tables:", error);
        throw error;
    }
};

module.exports = { createTables };