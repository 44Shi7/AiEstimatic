import { pool } from "../config/database.js";

export interface ProjectRow {
  id: number;
  project_id: string;
  project_name: string;
  address: string;
  rev: string;
  client_name: string;
  client_id: string;
  date: string;
  items: string;
  summary: string;
  item_count: number;
  timestamp: Date;
}

export interface ProjectResponse {
  id: number;
  project_id: string;
  project_name: string;
  address: string;
  rev: string;
  client_name: string;
  client_id: string;
  date: string;
  items: unknown[];
  summary: unknown;
  item_count: number;
  timestamp: Date;
  projectId: string;
  projectName: string;
  clientName: string;
  clientId: string;
  itemCount: number;
}

export interface CreateProjectBody {
  projectId: string;
  projectName: string;
  address: string;
  rev: string;
  clientName: string;
  clientId: string;
  date: string;
  items: unknown;
  summary: unknown;
  itemCount: number;
}

export async function getProjects(): Promise<ProjectResponse[]> {
  const { rows } = await pool.query(
    "SELECT * FROM projects ORDER BY timestamp DESC"
  );
  return (rows as ProjectRow[]).map((r) => ({
    ...r,
    projectId: r.project_id,
    projectName: r.project_name,
    clientName: r.client_name,
    clientId: r.client_id,
    itemCount: r.item_count,
    items: r.items ? JSON.parse(r.items) : [],
    summary: r.summary ? JSON.parse(r.summary) : null,
  }));
}

export async function createOrUpdateProject(body: CreateProjectBody): Promise<void> {
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
      body.projectId,
      body.projectName,
      body.address,
      body.rev,
      body.clientName,
      body.clientId,
      body.date,
      JSON.stringify(body.items),
      JSON.stringify(body.summary),
      body.itemCount,
    ]
  );
}

export async function deleteProject(projectId: string): Promise<void> {
  await pool.query("DELETE FROM projects WHERE project_id = $1", [projectId]);
}
