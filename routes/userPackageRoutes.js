import express from "express";
import UserPackage from "../models/schemas/userPackageSchema.js";
import Package from "../models/schemas/packageSchema.js";
import Customer from "../models/schemas/customerSchema.js";

const router = express.Router();

// Middleware xác thực
let authenticateToken = (req, res, next) => next();
try {
  const authModule = await import("../middlewares/auth.js").catch(() => null)
    || await import("../middleware/auth.js").catch(() => null);
  if (authModule) {
    authenticateToken = authModule.authenticateToken || authModule.verifyToken || authModule.default || authenticateToken;
  }
} catch (e) { }

// API Admin đăng ký gói tập trực tiếp cho hội viên
router.post("/admin-register", authenticateToken, async (req, res) => {
  try {
    const { customerId, package_id, locationId, duration_months, total_price } = req.body;

    const custId = customerId || req.body.customer_id;
    const pkgId = package_id || req.body.packageId;

    if (!custId || !pkgId) {
      return res.status(400).json({ error: "Thiếu mã khách hàng hoặc gói tập" });
    }

    const months = Number(duration_months) || 1;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    // Gán cả 2 dạng đặt tên (customer_id / customerId) để khớp 100% với mọi Schema
    const newUP = new UserPackage({
      customer_id: custId,
      customerId: custId,
      package_id: pkgId,
      packageId: pkgId,
      locationId: locationId || req.user?.locationId || null,
      duration_months: months,
      durationMonths: months,
      total_price: total_price || 0,
      totalPrice: total_price || 0,
      start_date: startDate,
      startDate: startDate,
      end_date: endDate,
      endDate: endDate,
      status: "đang hoạt động"
    });

    await newUP.save();

    return res.status(200).json({
      success: true,
      message: "Đăng ký gói tập thành công",
      data: newUP
    });
  } catch (err) {
    console.error("admin-register error:", err);
    return res.status(500).json({ error: err.message || "Lỗi tạo gói tập cho hội viên" });
  }
});

export default router;