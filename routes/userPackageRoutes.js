import express from "express";
import {
  authenticateToken,
  authorizeRoles,
  requireAdmin,
  requireStaff,
} from "../middleware/authMiddleware.js";
import {
  registerPackage,
  listMyPackages,
  getRegistrationDetail,
  cancelRegistration,
  listAllRegistrations,
  confirmPayment,
  setPaymentMethod,
  createRenewOrUpgrade,
  calculateUpgrade,
  createVnPayUrl,
  vnpayReturn,
  vnpayIPN,
  transactionHistory,
  getMyPtSessions,
  deductPtSession,
  checkScheduleConflict,
  generateContractPdf,
  adminRegisterPackage,
  approveRegistration,
} from "../controllers/userPackageController.js";
import {
  adminRenewPackage,
  listRenewalTickets,
  listExpiring,
  sendRenewalReminders,
  sendPaymentReminder,
} from "../controllers/userPackageAdminController.js";

const router = express.Router();

router.get("/payments/list", authenticateToken, listAllRegistrations);
router.get("/all", authenticateToken, listAllRegistrations);
router.get("/check-conflict", authenticateToken, checkScheduleConflict);
router.post("/register", authenticateToken, registerPackage);
router.post("/admin-register", authenticateToken, adminRegisterPackage);
router.get("/my", authenticateToken, listMyPackages);
router.get("/transactions", authenticateToken, transactionHistory);
router.get("/pt-sessions", authenticateToken, getMyPtSessions);
router.post("/pt-sessions/deduct", authenticateToken, deductPtSession);
router.post("/calculate-upgrade", authenticateToken, calculateUpgrade);
router.post("/renew-upgrade", authenticateToken, createRenewOrUpgrade);

// ===== GIA HẠN HỘ + NHẮC (admin) =====
// Khách hết hạn -> admin tạo phiếu gia hạn -> duyệt là xong
router.post("/admin-renew", authenticateToken, requireAdmin, adminRenewPackage);
router.get("/renewal-tickets", authenticateToken, listRenewalTickets);

// Danh sách khách sắp hết hạn / đã hết hạn + gửi nhắc gia hạn hàng loạt
// (nhắc gia hạn là tác vụ vận hành: cả staff lẫn admin đều được gửi, hội viên bị chặn)
router.get("/expiring", authenticateToken, listExpiring);
router.post(
  "/renewal-reminders/send",
  authenticateToken,
  requireStaff,
  sendRenewalReminders,
);

// Nhắc thanh toán đơn chờ (thủ công cho từng đơn) - chỉ admin
router.post(
  "/:id/payment-reminder",
  authenticateToken,
  requireAdmin,
  sendPaymentReminder
);

// API cho VNPAY
router.get("/:id/vnpay-url", authenticateToken, createVnPayUrl); 
router.get("/vnpay-return", vnpayReturn);
router.get("/vnpay-ipn", vnpayIPN);
router.post("/vnpay-ipn", vnpayIPN);

router.get("/:id/contract-pdf", authenticateToken, generateContractPdf);
router.get("/:id", authenticateToken, getRegistrationDetail);
// Duyệt đăng ký & xác nhận thanh toán: CHỈ admin/staff.
// Hội viên không được tự đổi trạng thái thanh toán (chỉ chọn phương thức).
router.post(
  "/:id/approve",
  authenticateToken,
  requireAdmin,
  approveRegistration
);
router.post("/:id/cancel", authenticateToken, cancelRegistration);
router.patch(
  "/:id/payment",
  authenticateToken,
  requireAdmin,
  confirmPayment
);
router.patch("/:id/payment-method", authenticateToken, setPaymentMethod);

export default router;