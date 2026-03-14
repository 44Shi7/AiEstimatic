import { Request, Response } from "express";
import * as settingsService from "../services/settingsService.js";

export async function getSetting(req: Request, res: Response): Promise<void> {
  try {
    const value = await settingsService.getSetting(req.params.key);
    res.json(value);
  } catch {
    res.status(500).json({ error: "Failed to fetch setting" });
  }
}

export async function setSetting(req: Request, res: Response): Promise<void> {
  const { value } = req.body;
  try {
    await settingsService.setSetting(req.params.key, value);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to save setting" });
  }
}
