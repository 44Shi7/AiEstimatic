import { pool } from "../config/database.js";

export async function getSetting(key: string): Promise<unknown> {
  const { rows } = await pool.query(
    'SELECT value FROM settings WHERE "key" = $1',
    [key]
  );
  const row = rows[0] as { value: string } | undefined;
  return row ? JSON.parse(row.value) : null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await pool.query(
    `
    INSERT INTO settings (key, value)
    VALUES ($1, $2)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `,
    [key, JSON.stringify(value)]
  );
}
