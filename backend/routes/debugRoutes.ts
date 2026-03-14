import { Router } from "express";
import * as userController from "../controllers/userController.js";

const router = Router();

router.get("/users", userController.getUsersDebug);

export default router;
