import { Request, Response } from "express";
import * as projectService from "../services/projectService.js";

export async function getProjects(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await projectService.getProjects();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
}

export async function createOrUpdateProject(req: Request, res: Response): Promise<void> {
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
    await projectService.createOrUpdateProject({
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
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save project" });
  }
}

export async function deleteProject(req: Request, res: Response): Promise<void> {
  try {
    await projectService.deleteProject(req.params.projectId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete project" });
  }
}
