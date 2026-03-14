import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import ExcelJS from "exceljs";
import multer from "multer";
import fs from "fs";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), 'pricedb');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const type = req.query.type as string || 'Accubid';
    let filename = 'AccubidDevices_DataBase.xlsx';
    if (type === 'Conest') filename = 'Conest_DataBase.xlsx';
    if (type === 'McCormic') filename = 'McCormic_DataBase.xlsx';
    cb(null, filename);
  }
});

const upload = multer({ storage: storage });

// Database Configuration
let useMySQL = !!(process.env.MYSQL_HOST && process.env.MYSQL_DATABASE && process.env.MYSQL_HOST !== 'localhost' && process.env.MYSQL_HOST !== '127.0.0.1');
let sqliteDb: any = null;
let mysqlPool: any = null;

function setupDatabases() {
  if (useMySQL) {
    console.log("Attempting to use MySQL Database");
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: parseInt(process.env.MYSQL_PORT || "3306"),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000 // 5 second timeout
    });
  }
  
  // Always prepare SQLite as fallback
  console.log("Preparing SQLite Database (Fallback/Default)");
  sqliteDb = new Database("audit.db");
}

setupDatabases();

// Initialize database tables
async function initDb() {
  if (useMySQL) {
    try {
      const connection = await mysqlPool.getConnection();
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(255),
            user_name VARCHAR(255),
            user_role VARCHAR(255),
            event_type VARCHAR(255),
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await connection.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255),
            username VARCHAR(255) UNIQUE,
            password VARCHAR(255),
            role VARCHAR(255)
          )
        `);
        await connection.query(`
          CREATE TABLE IF NOT EXISTS projects (
            id INT AUTO_INCREMENT PRIMARY KEY,
            project_id VARCHAR(255) UNIQUE,
            project_name VARCHAR(255),
            address TEXT,
            rev VARCHAR(50),
            client_name VARCHAR(255),
            client_id VARCHAR(255),
            date VARCHAR(50),
            items LONGTEXT,
            summary LONGTEXT,
            item_count INT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await connection.query(`
          CREATE TABLE IF NOT EXISTS settings (
            \`key\` VARCHAR(255) PRIMARY KEY,
            \`value\` LONGTEXT
          )
        `);
        
        // Seed initial admin if not exists
        await connection.query(
          "INSERT IGNORE INTO users (id, name, username, password, role) VALUES (?, ?, ?, ?, ?)",
          ['admin-1', 'System Admin', 'admin', 'password@1231', 'ADMIN']
        );
        await connection.query(
          "INSERT IGNORE INTO users (id, name, username, password, role) VALUES (?, ?, ?, ?, ?)",
          ['test-1', 'estimatic Test User', 'ies.test', 'ies@test', 'END_USER']
        );
        console.log("MySQL Database initialized successfully");
      } finally {
        connection.release();
      }
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' && (process.env.MYSQL_HOST === 'localhost' || process.env.MYSQL_HOST === '127.0.0.1')) {
        console.log("MySQL not configured or not running locally. Falling back to SQLite.");
      } else {
        console.error("MySQL Connection failed, falling back to SQLite:", err);
      }
      useMySQL = false;
      initSqlite();
    }
  } else {
    initSqlite();
  }
}

function initSqlite() {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      user_name TEXT,
      user_role TEXT,
      event_type TEXT,
      details TEXT,
      timestamp DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT UNIQUE,
      project_name TEXT,
      address TEXT,
      rev TEXT,
      client_name TEXT,
      client_id TEXT,
      date TEXT,
      items TEXT,
      summary TEXT,
      item_count INTEGER,
      timestamp DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  
  const seedAdmin = sqliteDb.prepare("INSERT OR IGNORE INTO users (id, name, username, password, role) VALUES (?, ?, ?, ?, ?)");
  seedAdmin.run('admin-1', 'System Admin', 'admin', 'password@1231', 'ADMIN');
  seedAdmin.run('test-1', 'estimatic Test User', 'ies.test', 'ies@test', 'END_USER');
  seedAdmin.run('test-2', 'Afaq Aslam', 'afaq.aslam', 'Afaq@ies.com', 'POWER_USER');
  console.log("SQLite Database initialized successfully");
}

async function startServer() {
  await initDb();
  
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // User API Routes
  app.get("/api/users", async (req, res) => {
    try {
      if (useMySQL) {
        const [rows] = await mysqlPool.query("SELECT id, name, username, role FROM users");
        res.json(rows);
      } else {
        const users = sqliteDb.prepare("SELECT id, name, username, role FROM users").all();
        res.json(users);
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    const { id, name, username, password, role } = req.body;
    try {
      if (useMySQL) {
        await mysqlPool.query(`
          INSERT INTO users (id, name, username, password, role)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name=VALUES(name),
            username=VALUES(username),
            password=COALESCE(VALUES(password), password),
            role=VALUES(role)
        `, [id, name, username, password, role]);
      } else {
        const stmt = sqliteDb.prepare(`
          INSERT INTO users (id, name, username, password, role)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            username=excluded.username,
            password=COALESCE(excluded.password, users.password),
            role=excluded.role
        `);
        stmt.run(id, name, username, password, role);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      if (useMySQL) {
        await mysqlPool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
      } else {
        sqliteDb.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      let user;
      if (useMySQL) {
        const [rows]: any = await mysqlPool.query("SELECT id, name, username, role FROM users WHERE username = ? AND password = ?", [username, password]);
        user = rows[0];
      } else {
        user = sqliteDb.prepare("SELECT id, name, username, role FROM users WHERE username = ? AND password = ?").get(username, password);
      }
      
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
      if (useMySQL) {
        await mysqlPool.query(`
          INSERT INTO logs (user_id, user_name, user_role, event_type, details)
          VALUES (?, ?, ?, ?, ?)
        `, [userId, userName, userRole, eventType, JSON.stringify(details)]);
      } else {
        const stmt = sqliteDb.prepare(`
          INSERT INTO logs (user_id, user_name, user_role, event_type, details, timestamp)
          VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        `);
        stmt.run(userId, userName, userRole, eventType, JSON.stringify(details));
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to record log" });
    }
  });

  app.get("/api/logs", async (req, res) => {
    try {
      if (useMySQL) {
        const [rows] = await mysqlPool.query("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 500");
        res.json(rows);
      } else {
        const logs = sqliteDb.prepare("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 500").all();
        res.json(logs);
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.get("/api/stats", async (req, res) => {
    try {
      let projectCount, loginCount, uniqueUsers;
      
      if (useMySQL) {
        const [pRows]: any = await mysqlPool.query("SELECT COUNT(*) as count FROM logs WHERE event_type = 'PROJECT_COMPLETE'");
        const [lRows]: any = await mysqlPool.query("SELECT COUNT(*) as count FROM logs WHERE event_type = 'LOGIN'");
        const [uRows]: any = await mysqlPool.query("SELECT COUNT(DISTINCT user_id) as count FROM logs");
        projectCount = pRows[0];
        loginCount = lRows[0];
        uniqueUsers = uRows[0];
      } else {
        projectCount = sqliteDb.prepare("SELECT COUNT(*) as count FROM logs WHERE event_type = 'PROJECT_COMPLETE'").get();
        loginCount = sqliteDb.prepare("SELECT COUNT(*) as count FROM logs WHERE event_type = 'LOGIN'").get();
        uniqueUsers = sqliteDb.prepare("SELECT COUNT(DISTINCT user_id) as count FROM logs").get();
      }
      
      res.json({
        projectsDone: projectCount.count,
        totalLogins: loginCount.count,
        activeUsers: uniqueUsers.count
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
      if (useMySQL) {
        const [rows] = await mysqlPool.query("SELECT * FROM projects ORDER BY timestamp DESC");
        res.json(rows.map((r: any) => ({
          ...r,
          projectId: r.project_id,
          projectName: r.project_name,
          clientName: r.client_name,
          clientId: r.client_id,
          itemCount: r.item_count,
          items: JSON.parse(r.items),
          summary: JSON.parse(r.summary)
        })));
      } else {
        const projects = sqliteDb.prepare("SELECT * FROM projects ORDER BY timestamp DESC").all();
        res.json(projects.map((r: any) => ({
          ...r,
          projectId: r.project_id,
          projectName: r.project_name,
          clientName: r.client_name,
          clientId: r.client_id,
          itemCount: r.item_count,
          items: JSON.parse(r.items),
          summary: JSON.parse(r.summary)
        })));
      }
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
    const { projectId, projectName, address, rev, clientName, clientId, date, items, summary, itemCount } = req.body;
    try {
      if (useMySQL) {
        await mysqlPool.query(`
          INSERT INTO projects (project_id, project_name, address, rev, client_name, client_id, date, items, summary, item_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            project_name=VALUES(project_name),
            address=VALUES(address),
            rev=VALUES(rev),
            client_name=VALUES(client_name),
            client_id=VALUES(client_id),
            date=VALUES(date),
            items=VALUES(items),
            summary=VALUES(summary),
            item_count=VALUES(item_count),
            timestamp=CURRENT_TIMESTAMP
        `, [projectId, projectName, address, rev, clientName, clientId, date, JSON.stringify(items), JSON.stringify(summary), itemCount]);
      } else {
        const stmt = sqliteDb.prepare(`
          INSERT INTO projects (project_id, project_name, address, rev, client_name, client_id, date, items, summary, item_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_id) DO UPDATE SET
            project_name=excluded.project_name,
            address=excluded.address,
            rev=excluded.rev,
            client_name=excluded.client_name,
            client_id=excluded.client_id,
            date=excluded.date,
            items=excluded.items,
            summary=excluded.summary,
            item_count=excluded.item_count,
            timestamp=strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        `);
        stmt.run(projectId, projectName, address, rev, clientName, clientId, date, JSON.stringify(items), JSON.stringify(summary), itemCount);
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save project" });
    }
  });

  app.delete("/api/projects/:projectId", async (req, res) => {
    try {
      if (useMySQL) {
        await mysqlPool.query("DELETE FROM projects WHERE project_id = ?", [req.params.projectId]);
      } else {
        sqliteDb.prepare("DELETE FROM projects WHERE project_id = ?").run(req.params.projectId);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Settings API Routes
  app.get("/api/settings/:key", async (req, res) => {
    try {
      let row;
      if (useMySQL) {
        const [rows]: any = await mysqlPool.query("SELECT value FROM settings WHERE \`key\` = ?", [req.params.key]);
        row = rows[0];
      } else {
        row = sqliteDb.prepare("SELECT value FROM settings WHERE key = ?").get(req.params.key);
      }
      res.json(row ? JSON.parse(row.value) : null);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.post("/api/settings/:key", async (req, res) => {
    const { value } = req.body;
    try {
      if (useMySQL) {
        await mysqlPool.query(`
          INSERT INTO settings (\`key\`, \`value\`)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE value=VALUES(value)
        `, [req.params.key, JSON.stringify(value)]);
      } else {
        const stmt = sqliteDb.prepare(`
          INSERT INTO settings (key, value)
          VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value
        `);
        stmt.run(req.params.key, JSON.stringify(value));
      }
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
