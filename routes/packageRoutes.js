import express from "express";
import {
  authenticateToken,
  optionalAuth,
  requireAdmin,
} from "../middleware/authMiddleware.js";
import * as PackageController from "../controllers/packageController.js";
import * as PackageAdminController from "../controllers/packageAdminController.js";

const router = express.Router();

// ============================================================
// PUBLIC ROUTES
// Khách (không token / token hội viên) chỉ thấy gói "đang bán".
// Staff (token hợp lệ) thấy toàn bộ vòng đời + được lọc status/search.
// ============================================================
router.get("/", optionalAuth, PackageController.listPackages);
router.get("/preview-price", optionalAuth, PackageAdminController.previewPrice);
router.post("/preview-price", optionalAuth, PackageAdminController.previewPrice);
router.get(
  "/by-discipline/:disciplineId",
  optionalAuth,
  PackageController.getPackagesByDisciplineId,
);
router.get("/:id/related", optionalAuth, PackageController.listRelatedPackages);

// Xuất hợp đồng + bảng giá theo gói (in ra để ký cho khách)
router.get("/:id/contract-pdf", optionalAuth, PackageAdminController.exportContractPdf);

// Chi tiết gói: khách 404 nếu gói không còn "đang bán"
router.get("/:id", optionalAuth, PackageController.getPackageDetail);

// ============================================================
// QUẢN LÝ GÓI - VÒNG ĐỜI (nháp -> đang bán -> tạm ngưng -> ngừng bán)
// ============================================================
router.patch(
  "/:id/lifecycle-status",
  authenticateToken,
  requireAdmin,
  PackageAdminController.changeLifecycleStatus,
);

// Số người đang sở hữu + danh sách ai đang dùng (phân trang, tìm kiếm)
router.get(
  "/:id/subscribers",
  authenticateToken,
  PackageAdminController.listSubscribers,
);
router.get(
  "/:id/owner-count",
  authenticateToken,
  PackageAdminController.getOwnerCount,
);

// Lịch sử giá + bảng giá tự tính + xem trước giá theo số tháng
router.get(
  "/:id/price-history",
  authenticateToken,
  PackageAdminController.getPriceHistory,
);
router.get(
  "/:id/price-table",
  authenticateToken,
  PackageAdminController.getPriceTable,
);
router.post(
  "/:id/preview-price",
  authenticateToken,
  PackageAdminController.previewPrice,
);

// ============================================================
// ADMIN ROUTES (require authentication + staff role)
// ============================================================
router.post("/", authenticateToken, PackageController.addPackage);
router.put("/:id", authenticateToken, PackageController.updatePackage);

// Chỉ xóa được gói NHÁP chưa có hội viên; gói có hội viên sẽ bị chặn (409)
// và phải chuyển sang "ngừng bán".
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  PackageController.deletePackage,
);

export default router;
