import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Ensure data directory exists
const dataDir = path.join(process.cwd(), "data");
console.log(`Database directory: ${dataDir}`);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "events.db");
console.log(`Opening database at: ${dbPath}`);
const db = new Database(dbPath);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    location TEXT NOT NULL,
    price REAL NOT NULL,
    total_tickets INTEGER NOT NULL,
    tickets_sold INTEGER DEFAULT 0,
    image_url TEXT
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id)
  );
`);

// Seed admin user if not exists
const adminEmail = 'admin@evently.com';
const adminPassword = 'admin'; // In a real app, use hashing
const existingAdmin = db.prepare("SELECT * FROM users WHERE email = ?").get(adminEmail);
if (!existingAdmin) {
  db.prepare("INSERT INTO users (email, password, role) VALUES (?, ?, ?)").run(adminEmail, adminPassword, 'admin');
  console.log('Admin user seeded: admin@evently.com / admin');
}

if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log(`Database file initialized at ${dbPath}. Size: ${stats.size} bytes`);
} else {
  console.error(`CRITICAL: Database file NOT found at ${dbPath} after initialization!`);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Auth Routes
  app.post("/api/auth/register", (req, res) => {
    const { email, password } = req.body;
    try {
      const result = db.prepare("INSERT INTO users (email, password, role) VALUES (?, ?, 'user')").run(email, password);
      res.json({ id: result.lastInsertRowid, email, role: 'user' });
    } catch (error) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT id, email, role FROM users WHERE email = ? AND password = ?").get(email, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // API Routes
  app.get("/api/events", (req, res) => {
    const events = db.prepare("SELECT * FROM events ORDER BY date ASC").all();
    res.json(events);
  });

  app.get("/api/events/:id", (req, res) => {
    const event = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  });

  app.post("/api/events", (req, res) => {
    const { title, description, date, location, price, total_tickets, image_url } = req.body;
    const result = db.prepare(`
      INSERT INTO events (title, description, date, location, price, total_tickets, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title, description, date, location, price, total_tickets, image_url);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/events/:id", (req, res) => {
    const { id } = req.params;
    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM tickets WHERE event_id = ?").run(id);
      db.prepare("DELETE FROM events WHERE id = ?").run(id);
    });
    transaction();
    res.json({ success: true });
  });

  app.post("/api/tickets", (req, res) => {
    const { event_id, buyer_name, buyer_email } = req.body;
    
    const event = db.prepare("SELECT * FROM events WHERE id = ?").get(event_id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.tickets_sold >= event.total_tickets) {
      return res.status(400).json({ error: "Sold out" });
    }

    const transaction = db.transaction(() => {
      db.prepare("INSERT INTO tickets (event_id, buyer_name, buyer_email) VALUES (?, ?, ?)").run(event_id, buyer_name, buyer_email);
      db.prepare("UPDATE events SET tickets_sold = tickets_sold + 1 WHERE id = ?").run(event_id);
    });

    transaction();
    res.json({ success: true });
  });

  app.get("/api/tickets/:email", (req, res) => {
    const { email } = req.params;
    const tickets = db.prepare(`
      SELECT t.*, e.title as event_title, e.date as event_date, e.location as event_location, e.image_url as event_image
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.buyer_email = ?
      ORDER BY t.purchase_date DESC
    `).all(email);
    res.json(tickets);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
