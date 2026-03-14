import { Router } from "express";
import * as settingsController from "../controllers/settingsController.js";

const router = Router();

router.get("/:key", settingsController.getSetting);
router.post("/:key", settingsController.setSetting);

export default router;
