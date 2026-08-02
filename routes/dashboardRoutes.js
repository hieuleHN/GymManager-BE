import express from "express";
import { getAdminDashboardStats, getMonthlyDetail, getCheckinDetail, getSportDetail, getTrainerDetail } from "../controllers/dashboardController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/admin-stats", authenticateToken, getAdminDashboardStats);
router.get("/admin-stats/monthly-detail", authenticateToken, getMonthlyDetail);
router.get("/admin-stats/checkin-detail", authenticateToken, getCheckinDetail);
router.get("/admin-stats/sport-detail", authenticateToken, getSportDetail);
router.get("/admin-stats/trainer-detail", authenticateToken, getTrainerDetail);

export default router;