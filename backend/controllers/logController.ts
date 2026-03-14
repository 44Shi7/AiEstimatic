import { Request, Response } from "express";
import * as logService from "../services/logService.js";

export async function createLog(req: Request, res: Response): Promise<void> {
  const { userId, userName, userRole, eventType, details } = req.body;
  try {
    await logService.createLog({
      userId,
      userName,
      userRole,
      eventType,
      details,
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record log" });
  }
}

export async function getLogs(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await logService.getLogs(500);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
}

export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const stats = await logService.getStats();
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}
