import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { getFinanceStatistics, getOperationsStatistics } from "../controllers/statisticsController.js";

const router = express.Router();

router.get("/finance", authenticateToken, getFinanceStatistics);
router.get("/operations", authenticateToken, getOperationsStatistics);

export default router;
