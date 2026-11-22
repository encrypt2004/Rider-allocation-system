import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  setupDemo,
  getDemoDashboard,
  allocateDemoOrder,
  resetDemo,
  moveDemoRiders,
  updateDemoOrderStatus
} from "../controllers/demoController.js";

const router = express.Router();
router.use(protect);
router.post("/setup", setupDemo);
router.get("/dashboard", getDemoDashboard);
router.post("/allocate", allocateDemoOrder);
router.post("/reset", resetDemo);
router.post("/simulation/tick", moveDemoRiders);
router.patch("/orders/:orderNumber/status", updateDemoOrderStatus);

export default router;
