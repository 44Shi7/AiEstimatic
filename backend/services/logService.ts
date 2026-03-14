import { pool } from "../config/database.js";

export interface CreateLogBody {
  userId: string;
  userName: string;
  userRole: string;
  eventType: string;
  details: unknown;
}

export async function createLog(body: CreateLogBody): Promise<void> {
  await pool.query(
    `
    INSERT INTO logs (user_id, user_name, user_role, event_type, details)
    VALUES ($1, $2, $3, $4, $5)
  `,
    [
      body.userId,
      body.userName,
      body.userRole,
      body.eventType,
      JSON.stringify(body.details),
    ]
  );
}

export async function getLogs(limit = 500): Promise<unknown[]> {
  const { rows } = await pool.query(
    "SELECT * FROM logs ORDER BY timestamp DESC LIMIT $1",
    [limit]
  );
  return rows;
}

export interface StatsResult {
  projectsDone: number;
  totalLogins: number;
  activeUsers: number;
}

export async function getStats(): Promise<StatsResult> {
  const projectCountResult = await pool.query(
    "SELECT COUNT(*) as count FROM logs WHERE event_type = 'PROJECT_COMPLETE'"
  );
  const loginCountResult = await pool.query(
    "SELECT COUNT(*) as count FROM logs WHERE event_type = 'LOGIN'"
  );
  const uniqueUsersResult = await pool.query(
    "SELECT COUNT(DISTINCT user_id) as count FROM logs"
  );

  const projectCount = projectCountResult.rows[0] as { count: string };
  const loginCount = loginCountResult.rows[0] as { count: string };
  const uniqueUsers = uniqueUsersResult.rows[0] as { count: string };

  return {
    projectsDone: Number(projectCount.count),
    totalLogins: Number(loginCount.count),
    activeUsers: Number(uniqueUsers.count),
  };
}
