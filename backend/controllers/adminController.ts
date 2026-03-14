import { Request, Response } from "express";
import * as adminService from "../services/adminService.js";

export function uploadDb(req: Request, res: Response): void {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  res.json({ success: true, message: "Database updated successfully" });
}

export function getDbStats(req: Request, res: Response): void {
  const type = (req.query.type as string) || "Accubid";
  try {
    const result = adminService.getDbStats(type);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch DB stats" });
  }
}
