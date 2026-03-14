import { pool } from "../config/database.js";

export interface UserRow {
  id: string;
  name: string;
  username: string;
  role: string;
}

export interface UserDebugRow {
  id: string;
  username: string;
  password: string;
  role: string;
}

export interface CreateUserBody {
  id: string;
  name: string;
  username: string;
  password: string | null;
  role: string;
}

export async function getUsers(): Promise<UserRow[]> {
  const { rows } = await pool.query(
    "SELECT id, name, username, role FROM users"
  );
  return rows as UserRow[];
}

export async function getUsersDebug(): Promise<UserDebugRow[]> {
  const { rows } = await pool.query(
    "SELECT id, username, password, role FROM users ORDER BY id"
  );
  return rows as UserDebugRow[];
}

export async function createOrUpdateUser(body: CreateUserBody): Promise<void> {
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
    [body.id, body.name, body.username, body.password ?? null, body.role]
  );
}

export async function deleteUser(id: string): Promise<void> {
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
}
