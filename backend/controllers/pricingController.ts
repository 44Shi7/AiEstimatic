import { Request, Response } from "express";
import * as pricingService from "../services/pricingService.js";

export async function getPricing(req: Request, res: Response): Promise<void> {
  const { item } = req.body;
  const { type } = req.params;
  if (!item) {
    res.status(400).json({ error: "Item name is required" });
    return;
  }

  try {
    const bestMatch = await pricingService.findPricing(type, item);
    if (bestMatch) {
      res.json(bestMatch);
    } else {
      res
        .status(404)
        .json({ error: `No matching item found in ${type} database` });
    }
  } catch (err) {
    if (err instanceof pricingService.DatabaseNotFoundError) {
      res.status(404).json({ error: `Database for ${type} not found` });
      return;
    }
    console.error(`${type} Database Error:`, err);
    res.status(500).json({ error: `Failed to read ${type} database` });
  }
}
