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
import {
  getDemoResources,
  createDemoRider,
  updateDemoRider,
  createDemoRestaurant,
  createDemoOrder
} from "../controllers/demoResourceController.js";

const router = express.Router();
router.use(protect);
router.post("/setup", setupDemo);
router.get("/dashboard", getDemoDashboard);
router.post("/allocate", allocateDemoOrder);
router.post("/reset", resetDemo);
router.post("/simulation/tick", moveDemoRiders);
router.patch("/orders/:orderNumber/status", updateDemoOrderStatus);

// Owner-scoped CRUD endpoints for the logged-in demo workspace.
router.get("/resources", getDemoResources);
router.post("/riders", createDemoRider);
router.patch("/riders/:code", updateDemoRider);
router.post("/restaurants", createDemoRestaurant);
router.post("/orders", createDemoOrder);

export default router;
