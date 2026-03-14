import { Request, Response } from "express";
import * as authService from "../services/authService.js";

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;
  try {
    const user = await authService.login(username, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
}
