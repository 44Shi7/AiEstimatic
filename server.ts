import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import ExcelJS from "exceljs";
import multer from "multer";
import fs from "fs";
import { Pool } from "pg";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), "pricedb");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const type = (req.query.type as string) || "Accubid";
    let filename = "AccubidDevices_DataBase.xlsx";
    if (type === "Conest") filename = "Conest_DataBase.xlsx";
    if (type === "McCormic") filename = "McCormic_DataBase.xlsx";
    cb(null, filename);
  },
});

const upload = multer({ storage: storage });

// Postgres (Neon) Database Configuration
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Please configure your Neon Postgres connection string.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon recommends SSL; URL already has sslmode=require, but this keeps Node happy in most environments.
  ssl: process.env.DATABASE_URL.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

// Initialize database tables and seed data
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        user_name TEXT,
        user_role TEXT,
        event_type TEXT,
        details TEXT,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        project_id TEXT UNIQUE,
        project_name TEXT,
        address TEXT,
        rev TEXT,
        client_name TEXT,
        client_id TEXT,
        date TEXT,
        items TEXT,
        summary TEXT,
        item_count INT,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    // Seed initial admin and test users (id-based conflict to avoid duplicates)
    await pool.query(
      `
      INSERT INTO users (id, name, username, password, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
    `,
      ["admin-1", "System Admin", "admin", "password@1231", "ADMIN"]
    );

    await pool.query(
      `
      INSERT INTO users (id, name, username, password, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
    `,
      ["test-1", "estimatic Test User", "ies.test", "ies@test", "END_USER"]
    );

    await pool.query(
      `
      INSERT INTO users (id, name, username, password, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
    `,
      ["test-2", "Afaq Aslam", "afaq.aslam", "Afaq@ies.com", "POWER_USER"]
    );

    console.log("Postgres (Neon) database initialized successfully");
  } catch (err) {
    console.error("Failed to initialize Postgres database:", err);
    throw err;
  }
}

async function startServer() {
  await initDb();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // User API Routes
  app.get("/api/users", async (req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, name, username, role FROM users"
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Temporary: debug endpoint to inspect seeded users
  app.get("/api/debug/users", async (req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, username, password, role FROM users ORDER BY id"
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch debug users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    const { id, name, username, password, role } = req.body;
    try {
      await pool.query(
        `
        INSERT INTO users (id, name, username, password, role)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          username = EXCLUDED.username,
          password = COALESCE(EXCLUDED.password, users.password),
          role = EXCLUDED.role
      `,
        [id, name, username, password ?? null, role]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const { rows } = await pool.query(
        "SELECT id, name, username, role FROM users WHERE username = $1 AND password = $2",
        [username, password]
      );
      const user = rows[0];

      if (user) {
        res.json(user);
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (err) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Audit API Routes
  app.post("/api/logs", async (req, res) => {
    const { userId, userName, userRole, eventType, details } = req.body;
    try {
      await pool.query(
        `
        INSERT INTO logs (user_id, user_name, user_role, event_type, details)
        VALUES ($1, $2, $3, $4, $5)
      `,
        [userId, userName, userRole, eventType, JSON.stringify(details)]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to record log" });
    }
  });

  app.get("/api/logs", async (req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM logs ORDER BY timestamp DESC LIMIT 500"
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.get("/api/stats", async (req, res) => {
    try {
      const projectCountResult = await pool.query(
        "SELECT COUNT(*) as count FROM logs WHERE event_type = 'PROJECT_COMPLETE'"
      );
      const loginCountResult = await pool.query(
        "SELECT COUNT(*) as count FROM logs WHERE event_type = 'LOGIN'"
      );
      const uniqueUsersResult = await pool.query(
        "SELECT COUNT(DISTINCT user_id) as count FROM logs"
      );

      const projectCount = projectCountResult.rows[0];
      const loginCount = loginCountResult.rows[0];
      const uniqueUsers = uniqueUsersResult.rows[0];

      res.json({
        projectsDone: Number(projectCount.count),
        totalLogins: Number(loginCount.count),
        activeUsers: Number(uniqueUsers.count),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Admin API Routes
  app.post("/api/admin/upload-db", upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({ success: true, message: "Database updated successfully" });
  });

  app.get("/api/admin/db-stats", (req, res) => {
    const type = req.query.type as string || 'Accubid';
    let filename = 'AccubidDevices_DataBase.xlsx';
    if (type === 'Conest') filename = 'Conest_DataBase.xlsx';
    if (type === 'McCormic') filename = 'McCormic_DataBase.xlsx';
    
    const filePath = path.join(process.cwd(), 'pricedb', filename);
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        res.json({
          exists: true,
          size: stats.size,
          lastModified: stats.mtime,
          name: filename
        });
      } else {
        res.json({ exists: false });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch DB stats" });
    }
  });

  // Project API Routes
  app.get("/api/projects", async (req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM projects ORDER BY timestamp DESC"
      );
      res.json(
        rows.map((r: any) => ({
          ...r,
          projectId: r.project_id,
          projectName: r.project_name,
          clientName: r.client_name,
          clientId: r.client_id,
          itemCount: r.item_count,
          items: r.items ? JSON.parse(r.items) : [],
          summary: r.summary ? JSON.parse(r.summary) : null,
        }))
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.post("/api/pricing/:type", async (req, res) => {
    const { item } = req.body;
    const { type } = req.params;
    if (!item) return res.status(400).json({ error: "Item name is required" });

    let filename = 'AccubidDevices_DataBase.xlsx';
    if (type === 'Conest') filename = 'Conest_DataBase.xlsx';
    if (type === 'McCormic') filename = 'McCormic_DataBase.xlsx';

    const workbook = new ExcelJS.Workbook();
    const filePath = path.join(process.cwd(), 'pricedb', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Database for ${type} not found` });
    }

    try {
      await workbook.xlsx.readFile(filePath);
      let bestMatch = null;
      let highestScore = 0;

      workbook.worksheets.forEach(worksheet => {
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber <= 5) return; // Skip headers
          
          const description = row.getCell(2).value?.toString() || "";
          const unitCost = parseFloat(row.getCell(7).value?.toString() || "0");
          const laborRate = parseFloat(row.getCell(11).value?.toString() || "0");

          if (description && unitCost > 0) {
            const searchWords = item.toLowerCase().split(/\s+/);
            const descLower = description.toLowerCase();
            let matches = 0;
            searchWords.forEach((word: string) => {
              if (descLower.includes(word)) matches++;
            });

            const score = matches / searchWords.length;
            if (score > highestScore) {
              highestScore = score;
              bestMatch = { unitCost, labor: laborRate, description };
            }
          }
        });
      });

      if (bestMatch && highestScore > 0.5) {
        res.json(bestMatch);
      } else {
        res.status(404).json({ error: `No matching item found in ${type} database` });
      }
    } catch (err) {
      console.error(`${type} Database Error:`, err);
      res.status(500).json({ error: `Failed to read ${type} database` });
    }
  });

  app.post("/api/projects", async (req, res) => {
    const {
      projectId,
      projectName,
      address,
      rev,
      clientName,
      clientId,
      date,
      items,
      summary,
      itemCount,
    } = req.body;
    try {
      await pool.query(
        `
        INSERT INTO projects (project_id, project_name, address, rev, client_name, client_id, date, items, summary, item_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (project_id) DO UPDATE SET
          project_name = EXCLUDED.project_name,
          address = EXCLUDED.address,
          rev = EXCLUDED.rev,
          client_name = EXCLUDED.client_name,
          client_id = EXCLUDED.client_id,
          date = EXCLUDED.date,
          items = EXCLUDED.items,
          summary = EXCLUDED.summary,
          item_count = EXCLUDED.item_count,
          timestamp = CURRENT_TIMESTAMP
      `,
        [
          projectId,
          projectName,
          address,
          rev,
          clientName,
          clientId,
          date,
          JSON.stringify(items),
          JSON.stringify(summary),
          itemCount,
        ]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save project" });
    }
  });

  app.delete("/api/projects/:projectId", async (req, res) => {
    try {
      await pool.query("DELETE FROM projects WHERE project_id = $1", [
        req.params.projectId,
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Settings API Routes
  app.get("/api/settings/:key", async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT value FROM settings WHERE "key" = $1',
        [req.params.key]
      );
      const row = rows[0];
      res.json(row ? JSON.parse(row.value) : null);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.post("/api/settings/:key", async (req, res) => {
    const { value } = req.body;
    try {
      await pool.query(
        `
        INSERT INTO settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `,
        [req.params.key, JSON.stringify(value)]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save setting" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
