import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/authMiddleware.js";
import { listAuditLogs } from "../controllers/auditLogController.js";

const router = express.Router();

// Mọi thao tác quản trị (đổi trạng thái, đổi giá, xóa, duyệt...) đều ghi log
router.get("/", authenticateToken, requireAdmin, listAuditLogs);

export default router;
