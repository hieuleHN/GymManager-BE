import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
    list,
    getNext,
    createRow,
    addLockers,
    update,
    assign,
    release,
    completeMaintenance,
    remove,
    removeRow,
    statusOverview,
    validateLockerCode
} from "../controllers/lockerManagementController.js";

const router = express.Router();

// Gán middleware auth cho toàn bộ route tủ đồ (xác định phòng tập hiện tại từ token)
router.use(authenticateToken);

// GET /api/v2/lockers/status - Lấy trạng thái tổng quan hệ thống tủ đồ
router.get("/status", statusOverview);

// POST /api/v2/lockers/validate - Kiểm tra tính hợp lệ của mã tủ
router.post("/validate", (req, res) => {
    const { lockerCode } = req.body;
    const isValid = validateLockerCode(lockerCode);
    return res.status(200).json({
        success: true,
        lockerCode,
        isValid,
        message: isValid ? "Mã tủ đồ hợp lệ" : "Mã tủ đồ không đúng định dạng (Ví dụ đúng: LK-001)"
    });
});

// GET /api/v2/lockers/next?prefix=LK&count=5 - Mã tủ tiếp theo (preview)
router.get("/next", getNext);

// Lưu ý: các route có tham số (:id) phải khai báo SAU các route tĩnh phía trên
// POST /api/v2/lockers/row - Tạo dãy tủ mới
router.post("/row", createRow);

// POST /api/v2/lockers/add - Thêm tủ vào dãy
router.post("/add", addLockers);

// DELETE /api/v2/lockers/row/:prefix - Xóa toàn bộ dãy tủ
router.delete("/row/:prefix", removeRow);

// GET /api/v2/lockers - Danh sách toàn bộ tủ
router.get("/", list);

// POST /api/v2/lockers/:id/assign - Gán tủ
router.post("/:id/assign", assign);

// POST /api/v2/lockers/:id/release - Trả tủ
router.post("/:id/release", release);

// POST /api/v2/lockers/:id/complete-maintenance - Hoàn tất bảo trì
router.post("/:id/complete-maintenance", completeMaintenance);

// PATCH /api/v2/lockers/:id - Cập nhật trạng thái / ghi chú
router.patch("/:id", update);

// DELETE /api/v2/lockers/:id - Xóa một tủ
router.delete("/:id", remove);

export default router;
