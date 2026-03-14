import { Router } from "express";
import * as logController from "../controllers/logController.js";

const router = Router();

router.post("/", logController.createLog);
router.get("/", logController.getLogs);

export default router;
