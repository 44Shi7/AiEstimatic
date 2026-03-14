import { pool } from "../config/database.js";

export interface LoginUser {
  id: string;
  name: string;
  username: string;
  role: string;
}

export async function login(
  username: string,
  password: string
): Promise<LoginUser | null> {
  const { rows } = await pool.query(
    "SELECT id, name, username, role FROM users WHERE username = $1 AND password = $2",
    [username, password]
  );
  return (rows[0] as LoginUser) ?? null;
}
