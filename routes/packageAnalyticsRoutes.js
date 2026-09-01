import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/authMiddleware.js";
import { getPackageAnalytics } from "../controllers/packageAnalyticsController.js";

const router = express.Router();

router.get("/", authenticateToken, requireAdmin, getPackageAnalytics);

export default router;