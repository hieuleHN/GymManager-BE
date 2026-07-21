import express from "express";
import { getAdminDashboardStats } from "../controllers/dashboardController.js";
import { authenticateToken } from "../middleware/authMiddleware.js"; // Đảm bảo đúng file middleware của bạn

const router = express.Router();

// Chỉ những ai đã đăng nhập tài khoản nhân viên/admin có token hợp lệ mới được gọi API này
router.get("/admin-stats", authenticateToken, getAdminDashboardStats);

export default router;