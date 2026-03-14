import { Router } from "express";
import * as userController from "../controllers/userController.js";

const router = Router();

router.get("/", userController.getUsers);
router.post("/", userController.createOrUpdateUser);
router.delete("/:id", userController.deleteUser);

export default router;
