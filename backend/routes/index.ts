import { Router } from "express";
import * as logController from "../controllers/logController.js";
import userRoutes from "./userRoutes.js";
import debugRoutes from "./debugRoutes.js";
import authRoutes from "./authRoutes.js";
import logRoutes from "./logRoutes.js";
import projectRoutes from "./projectRoutes.js";
import settingsRoutes from "./settingsRoutes.js";
import adminRoutes from "./adminRoutes.js";
import pricingRoutes from "./pricingRoutes.js";

const router = Router();

router.use("/users", userRoutes);
router.use("/debug", debugRoutes);
router.use("/auth", authRoutes);
router.use("/logs", logRoutes);
router.get("/stats", logController.getStats);
router.use("/admin", adminRoutes);
router.use("/projects", projectRoutes);
router.use("/settings", settingsRoutes);
router.use("/pricing", pricingRoutes);

export default router;
