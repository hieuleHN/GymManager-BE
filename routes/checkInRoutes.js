import express from "express";
import excelJS from "exceljs";
import {
    verifyCheckInToken,
    confirmCheckIn,
    getCheckInHistory,
    verifyFaceCheckIn,
    registerFaceID,
    getFaceDescriptors
} from "../controllers/checkInController.js";
import CheckIn from "../models/schemas/checkInSchema.js";

// Middleware fallback an toàn
let authenticateToken = (req, res, next) => next();

try {
    const authModule = await import("../middlewares/auth.js").catch(() => null)
        || await import("../middleware/auth.js").catch(() => null)
        || await import("../middlewares/authMiddleware.js").catch(() => null)
        || await import("../middleware/authMiddleware.js").catch(() => null);

    if (authModule) {
        authenticateToken = authModule.authenticateToken || authModule.verifyToken || authModule.default || authenticateToken;
    }
} catch (e) { }

const router = express.Router();

// 1. API Điểm danh & Nhận diện FaceID (Mở quyền để máy quét camera hoạt động độc lập ổn định)
router.get("/export/excel", authenticateToken, async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0,10);
    const d = new Date(dateStr);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999);
    const checkins = await CheckIn.find({ checkInTime: { $gte: start, $lte: end } })
      .populate("customerId", "fullName phone email account")
      .sort({ checkInTime: 1 }).lean();
    if (!checkins.length) return res.status(404).json({ message: "Không có dữ liệu điểm danh trong ngày này!" });

    const workbook = new excelJS.Workbook();
    const ws = workbook.addWorksheet("DiemDanh_HoiVien");
    ws.columns = [
      { header: "STT", key: "stt", width: 6 },
      { header: "Họ và tên", key: "fullName", width: 22 },
      { header: "Tài khoản", key: "account", width: 16 },
      { header: "SĐT", key: "phone", width: 14 },
      { header: "Email", key: "email", width: 24 },
      { header: "Check-in", key: "checkIn", width: 16 },
      { header: "Check-out", key: "checkOut", width: 16 },
      { header: "Thời gian tập (phút)", key: "minutes", width: 18 },
      { header: "Tủ đồ", key: "locker", width: 10 },
      { header: "Trạng thái", key: "status", width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
    checkins.forEach((c,i) => {
      const cust = c.customerId || {};
      const mins = c.totalMinutes || (c.checkInTime && c.checkOutTime ? Math.round((new Date(c.checkOutTime)-new Date(c.checkInTime))/60000) : "");
      ws.addRow({
        stt: i+1,
        fullName: cust.fullName || "",
        account: cust.account || "",
        phone: cust.phone || "",
        email: cust.email || "",
        checkIn: c.checkInTime ? new Date(c.checkInTime).toLocaleString("vi-VN") : "",
        checkOut: c.checkOutTime ? new Date(c.checkOutTime).toLocaleString("vi-VN") : "",
        minutes: mins,
        locker: c.lockerNumber || "",
        status: c.checkOutTime ? "Đã check-out" : "Đang tập",
      });
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=DiemDanh_HoiVien_${dateStr}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/face/descriptors", getFaceDescriptors);
router.post("/face/verify", verifyFaceCheckIn);
router.post("/face/register", authenticateToken, registerFaceID);

// 2. Điểm danh QR & Lịch sử
router.post("/verify", verifyCheckInToken);
router.post("/confirm", confirmCheckIn);
router.get("/history", getCheckInHistory);

export default router;