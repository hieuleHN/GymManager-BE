import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/authMiddleware.js";
import { getFinanceStatistics, getOperationsStatistics } from "../controllers/statisticsController.js";

const router = express.Router();

router.get("/finance", authenticateToken, requireAdmin, getFinanceStatistics);
router.get("/operations", authenticateToken, requireAdmin, getOperationsStatistics);

export default router;
