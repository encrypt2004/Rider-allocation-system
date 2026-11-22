import express from "express";
import protect from "../middleware/authMiddleware.js";
import { setupDemo, getDemoDashboard, allocateDemoOrder } from "../controllers/demoController.js";

const router = express.Router();
router.use(protect);
router.post("/setup", setupDemo);
router.get("/dashboard", getDemoDashboard);
router.post("/allocate", allocateDemoOrder);

export default router;
