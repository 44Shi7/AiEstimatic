import { Request, Response } from "express";
import * as userService from "../services/userService.js";

export async function getUsers(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await userService.getUsers();
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch users" });
  }
}

export async function getUsersDebug(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await userService.getUsersDebug();
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch debug users" });
  }
}

export async function createOrUpdateUser(req: Request, res: Response): Promise<void> {
  const { id, name, username, password, role } = req.body;
  try {
    await userService.createOrUpdateUser({
      id,
      name,
      username,
      password: password ?? null,
      role,
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to save user" });
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    await userService.deleteUser(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete user" });
  }
}
