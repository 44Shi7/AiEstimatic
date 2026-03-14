import { Router } from "express";
import * as pricingController from "../controllers/pricingController.js";

const router = Router();

router.post("/:type", pricingController.getPricing);

export default router;
