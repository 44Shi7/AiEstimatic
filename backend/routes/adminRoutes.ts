import { Router } from "express";
import * as adminController from "../controllers/adminController.js";
import { upload } from "../config/multer.js";

const router = Router();

router.post("/upload-db", upload.single("file"), adminController.uploadDb);
router.get("/db-stats", adminController.getDbStats);

export default router;
