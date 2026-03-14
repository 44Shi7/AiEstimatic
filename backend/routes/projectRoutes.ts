import { Router } from "express";
import * as projectController from "../controllers/projectController.js";

const router = Router();

router.get("/", projectController.getProjects);
router.post("/", projectController.createOrUpdateProject);
router.delete("/:projectId", projectController.deleteProject);

export default router;
