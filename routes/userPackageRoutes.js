import express from "express";
import {
  authenticateToken,
  authorizeRoles,
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
  createVnPayUrl,
  vnpayReturn,
  vnpayIPN
} from "../controllers/userPackageController.js";

const router = express.Router();

router.get("/payments/list", authenticateToken, listAllRegistrations);
router.post("/register", authenticateToken, registerPackage);
router.get("/my", authenticateToken, listMyPackages);
router.post("/renew-upgrade", authenticateToken, createRenewOrUpgrade);

// API cho VNPAY
router.get("/:id/vnpay-url", authenticateToken, createVnPayUrl); 
router.get("/vnpay-return", vnpayReturn);
router.get("/vnpay-ipn", vnpayIPN);
router.post("/vnpay-ipn", vnpayIPN);

router.get("/:id", authenticateToken, getRegistrationDetail);
router.post("/:id/cancel", authenticateToken, cancelRegistration);
router.patch("/:id/payment", authenticateToken, confirmPayment);
router.patch("/:id/payment-method", authenticateToken, setPaymentMethod);

export default router;