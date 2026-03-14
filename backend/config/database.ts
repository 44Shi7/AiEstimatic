import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Please configure your Neon Postgres connection string."
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

export async function initDb(): Promise<void> {
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
