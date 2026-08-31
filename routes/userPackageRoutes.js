import express from "express";
import UserPackage from "../models/schemas/userPackageSchema.js";
import Package from "../models/schemas/packageSchema.js";
import Customer from "../models/schemas/customerSchema.js";
import { adminRenewPackage } from "../controllers/userPackageAdminController.js";
import { createRenewOrUpgrade, calculateUpgrade } from "../controllers/userPackageController.js";

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

// Gia hạn hộ (admin) - tạo ngay gói gia hạn nối tiếp, không cần duyệt
router.post("/admin-renew", authenticateToken, async (req, res) => {
  try {
    const { customerId, customer_id, registrationId, userPackageId, package_id, duration_months } = req.body;
    const cid = customerId || customer_id;
    const regId = registrationId || userPackageId;
    const monthsInput = Number(duration_months);
    if (!cid) return res.status(400).json({ error: "Thiếu mã khách hàng" });
    if (!monthsInput || monthsInput <=0) return res.status(400).json({ error: "Vui lòng chọn kỳ hạn" });
    let original = null;
    if (regId) {
      original = await UserPackage.findOne({ _id: regId, customer_id: cid });
      if (!original) original = await UserPackage.findById(regId);
      if (!original) return res.status(404).json({ error: "Không tìm thấy gói gốc" });
    }
    const pkgId = package_id || original?.package_id || original?.packageId;
    if (!pkgId) return res.status(400).json({ error: "Thiếu gói tập" });
    const pkg = await Package.findById(pkgId);
    if (!pkg) return res.status(404).json({ error: "Gói tập không tồn tại" });
    const { computeTierPrice } = await import("../services/pricingService.js");
    const { addMonths, allocatePtSessions } = await import("../services/ptSessionService.js");
    let pricing;
    try { pricing = computeTierPrice(pkg, monthsInput); } catch(e){ return res.status(400).json({ error: e.message }); }
    const now = new Date();
    let proposedStart = now;
    if (original?.end_date && new Date(original.end_date) > now) proposedStart = new Date(original.end_date);
    else if (original?.endDate && new Date(original.endDate) > now) proposedStart = new Date(original.endDate);
    const end = addMonths(proposedStart, pricing.months);
    const customer = await Customer.findById(cid).select("locationId");
    const newUP = new UserPackage({
      customer_id: cid, customerId: cid,
      package_id: pkg._id, packageId: pkg._id,
      locationId: original?.locationId || original?.locationId || customer?.locationId || pkg.locationId || null,
      duration_months: pricing.months, durationMonths: pricing.months,
      ptSessionsPerMonth: pkg.isFullMonth ? 0 : (pkg.ptSessionsPerMonth||0),
      isFullMonth: !!pkg.isFullMonth,
      monthlySessions: allocatePtSessions(proposedStart, pricing.months, pkg),
      total_price: pricing.total_price, totalPrice: pricing.total_price,
      unit_price_applied: pricing.unit_price,
      price_snapshot: { unit_price: pricing.unit_price, months: pricing.months, discount_percent: pricing.discount_percent },
      start_date: proposedStart, startDate: proposedStart,
      end_date: end, endDate: end,
      status: "đang hoạt động",
      payment_status: "đã thanh toán",
      payment_date: now,
      is_renewal_ticket: false
    });
    await newUP.save();
    return res.json({ success: true, message: "Gia hạn thành công", data: newUP, pricing });
  } catch (err) {
    console.error("admin-renew error", err);
    return res.status(500).json({ error: err.message });
  }
});
// Gia hạn / Nâng cấp tự phục vụ (member) - dùng chung cho admin khi cần
router.post("/renew-upgrade", authenticateToken, createRenewOrUpgrade);
router.post("/calculate-upgrade", authenticateToken, calculateUpgrade);
// Nâng cấp hộ (admin) - thực hiện ngay, nối tiếp phần còn lại
router.post("/admin-upgrade", authenticateToken, async (req, res) => {
  try {
    const { customerId, currentRegistrationId, newPackageId, signature } = req.body;
    const cid = customerId || req.body.customer_id;
    if (!cid || !currentRegistrationId || !newPackageId) return res.status(400).json({ error: "Thiếu thông tin" });
    const currentReg = await UserPackage.findById(currentRegistrationId).populate("package_id");
    if (!currentReg) return res.status(404).json({ error: "Không tìm thấy gói hiện tại" });
    const newPkg = await Package.findById(newPackageId);
    if (!newPkg) return res.status(404).json({ error: "Không tìm thấy gói mới" });
    const now = new Date();
    const startDate = new Date(currentReg.start_date || currentReg.startDate);
    const endDate = new Date(currentReg.end_date || currentReg.endDate);
    if (now >= endDate) return res.status(400).json({ error: "Gói hiện tại đã hết hạn, vui lòng gia hạn" });
    const totalDays = Math.ceil((endDate - startDate)/86400000);
    const usedDays = Math.max(0, Math.ceil((now - startDate)/86400000));
    const remainingDays = Math.max(0, totalDays - usedDays);
    const currentDailyRate = Number(currentReg.total_price || currentReg.totalPrice || 0) / (totalDays||1);
    const remainingValue = Math.floor(currentDailyRate * remainingDays);
    const newDailyRate = (newPkg.unitPrice || 0) / 30;
    const newPackageCost = Math.floor(newDailyRate * remainingDays);
    const diff = remainingValue - newPackageCost;
    const amountToPay = diff <0 ? Math.abs(diff) : 0;
    // Hủy gói cũ
    await UserPackage.findByIdAndUpdate(currentRegistrationId, { status: "đã hủy", payment_status: "đã hủy" });
    // Tạo gói mới nối tiếp, hiệu lực từ hôm nay đến hết hạn cũ (giữ nguyên kỳ hạn còn lại)
    const { addMonths, allocatePtSessions } = await import("../services/ptSessionService.js");
    const durationMonths = Math.max(1, Math.ceil(remainingDays/30));
    const newEnd = new Date(now); newEnd.setDate(newEnd.getDate() + remainingDays);
    const newUP = new UserPackage({
      customer_id: cid, customerId: cid,
      package_id: newPkg._id, packageId: newPkg._id,
      locationId: currentReg.locationId || newPkg.locationId || null,
      duration_months: durationMonths, durationMonths,
      ptSessionsPerMonth: newPkg.isFullMonth ? 0 : (newPkg.ptSessionsPerMonth||0),
      isFullMonth: !!newPkg.isFullMonth,
      monthlySessions: allocatePtSessions(now, durationMonths, newPkg),
      total_price: amountToPay >0 ? amountToPay : newPackageCost, totalPrice: amountToPay>0?amountToPay:newPackageCost,
      start_date: now, startDate: now,
      end_date: newEnd, endDate: newEnd,
      status: "đang hoạt động",
      payment_status: "đã thanh toán",
      payment_date: now,
      signature: signature || ""
    });
    await newUP.save();
    return res.json({ success: true, message: "Nâng cấp thành công", data: newUP, calculation: { remainingDays, remainingValue, newPackageCost, amountToPay, refundAmount: diff>0?diff:0 } });
  } catch (err) {
    console.error("admin-upgrade error", err);
    return res.status(500).json({ error: err.message });
  }
});

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