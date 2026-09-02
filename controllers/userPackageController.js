import {
  createRegistration,
  getUserPackages,
  getRegistrationById,
  cancelRegistrationById,
  getAllRegistrations,
  updatePaymentStatus,
  updatePaymentMethod,
  updateVnpayTransactionRef,
  findRegistrationByTxnRef,
  getTransactionHistory,
} from "../models/userPackageModel.js";
import Package from "../models/schemas/packageSchema.js";
import UserPackage from "../models/schemas/userPackageSchema.js";
import Booking from "../models/schemas/bookingSchema.js";
import vnpay from "../config/vnpayConfig.js";
import {
  IpnSuccess,
  IpnOrderNotFound,
  IpnFailChecksum,
  IpnInvalidAmount,
  IpnUnknownError,
} from "vnpay";
import { creditStaffWallets, debitStaffWallets } from "../utils/staffWalletHelper.js";
import { jsPDF } from "jspdf";
import Policy from "../models/schemas/policySchema.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { computeTierPrice } from "../services/pricingService.js";
import { addMonths, allocatePtSessions } from "../services/ptSessionService.js";
import { logAudit } from "../services/auditService.js";
import Notification from "../models/schemas/notificationSchema.js";

// Gửi notification cho hội viên (best-effort, không chặn flow chính)
const notifyMember = async ({ customerId, title, message, type, userPackageId }) => {
  try {
    await Notification.create({
      recipientId: customerId,
      recipientRole: "member",
      title,
      message,
      type,
      relatedUserPackageId: userPackageId || undefined,
    });
  } catch (err) {
    console.error("[UserPackage] Lỗi tạo thông báo:", err.message);
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// 1. CÁC HÀM CŨ GIỮ NGUYÊN (Không sửa đổi để tránh lỗi)
export const registerPackage = (req, res) => {
  const {
    package_id,
    locationId,
    duration_months,
    signature,
    payment_method,
  } = req.body;
  if (!package_id || !locationId || !duration_months)
    return res.status(400).json({ error: "Thiếu thông tin!" });

      Package.findById(package_id)
    .exec()
    .then((pkg) => {
      if (!pkg) return res.status(404).json({ error: "Gói không tồn tại!" });

      // Gói phải đang "đang bán" mới được đăng ký (nháp/tạm ngưng/ngừng bán tự ẩn)
      if (
        pkg.lifecycle_status &&
        pkg.lifecycle_status !== "đang bán"
      ) {
        return res
          .status(400)
          .json({ error: "Gói tập này hiện không bán, vui lòng chọn gói khác!" });
      }

      // QUY TẮC GIÁ: hệ thống tự tính theo giá tháng gốc + bảng giảm giá,
      // tuyệt đối không nhận total_price gõ tay từ client.
      let pricing;
      try {
        pricing = computeTierPrice(pkg, duration_months);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }

      const start_date = new Date();
      const end_date = addMonths(start_date, duration_months);

      const ptSessionsPerMonth = pkg.isFullMonth ? 0 : (pkg.ptSessionsPerMonth || 0);
      const isFullMonth = pkg.isFullMonth || false;

      // TỰ PHÂN BỔ BUỔI PT: tháng nào được cấp bao nhiêu buổi
      const monthlySessions = allocatePtSessions(start_date, duration_months, pkg);

      createRegistration(
        {
          customer_id: req.user.id,
          package_id,
          locationId,
          duration_months,
          ptSessionsPerMonth,
          isFullMonth,
          monthlySessions,
          total_price: pricing.total_price,
          unit_price_applied: pricing.unit_price,
          price_snapshot: {
            unit_price: pricing.unit_price,
            months: pricing.months,
            discount_percent: pricing.discount_percent,
          },
          signature,
          start_date,
          end_date,
          payment_method,
          payment_status: "chờ thanh toán",
        },
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          res
            .status(201)
            .json({ message: "Đăng ký thành công!", registration: result, pricing });
        },
      );
    })
    .catch((err) => res.status(500).json({ error: err.message }));
};

export const listMyPackages = async (req, res) => {
  try {
    const targetId = (req.query.customerId && (req.user.isStaff || req.user.isAdmin)) ? req.query.customerId : req.user.id;
    const regs = await new Promise((resolve, reject) => {
      getUserPackages(targetId, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.status(200).json(regs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getRegistrationDetail = (req, res) => {
  getRegistrationById(req.params.id, (err, reg) => res.status(200).json(reg));
};
export const cancelRegistration = (req, res) => {
  getRegistrationById(req.params.id, (err, reg) => {
    if (!err && reg && reg.payment_status === "đã thanh toán") {
      debitStaffWallets(Number(reg.total_price), `Hoàn tiền hủy đăng ký - ${Number(reg.total_price).toLocaleString('vi-VN')}₫`);
    }
    cancelRegistrationById(req.params.id, (err, result) =>
      res.status(200).json({ message: "Đã hủy" }),
    );
  });
};
export const listAllRegistrations = (req, res) => {
  let { page, limit, payment_status, locationId, status } = req.query;
  getAllRegistrations(
    Number(page) || 1,
    Number(limit) || 15,
    { payment_status, locationId, status },
    (err, result) => res.status(200).json(result),
  );
};

// Quản lý đăng ký gói tập hộ hội viên tại quầy (tạo bởi admin/lễ tân)
export const adminRegisterPackage = (req, res) => {
  const {
    customerId,
    package_id,
    locationId,
    duration_months,
    signature,
  } = req.body;

  if (!customerId) return res.status(400).json({ error: "Thiếu mã khách hàng!" });
  if (!package_id || !duration_months)
    return res.status(400).json({ error: "Vui lòng chọn gói tập và thời hạn!" });

  Package.findById(package_id)
    .exec()
    .then((pkg) => {
      if (!pkg) return res.status(404).json({ error: "Gói tập không tồn tại!" });

      // QUY TẮC GIÁ: giá luôn do hệ thống tính theo bảng giá hiện hành của gói
      let pricing;
      try {
        pricing = computeTierPrice(pkg, duration_months);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }

      const start_date = new Date();
      const end_date = addMonths(start_date, duration_months);

      const ptSessionsPerMonth = pkg.isFullMonth ? 0 : (pkg.ptSessionsPerMonth || 0);
      const isFullMonth = pkg.isFullMonth || false;
      const monthlySessions = allocatePtSessions(start_date, duration_months, pkg);

      createRegistration(
        {
          customer_id: customerId,
          package_id,
          locationId: locationId || pkg.locationId || null,
          duration_months: Number(duration_months),
          ptSessionsPerMonth,
          isFullMonth,
          monthlySessions,
          total_price: pricing.total_price,
          unit_price_applied: pricing.unit_price,
          price_snapshot: {
            unit_price: pricing.unit_price,
            months: pricing.months,
            discount_percent: pricing.discount_percent,
          },
          signature: signature || "",
          start_date,
          end_date,
          payment_status: "đã thanh toán",
          status: "đang hoạt động",
          confirmed_by: req.user?.id,
          confirmed_at: new Date(),
          payment_date: new Date(),
        },
        async (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          await logAudit(req, {
            action: "ADMIN_REGISTER_PACKAGE",
            entityType: "UserPackage",
            entityId: result._id,
            entityName: `${pkg.name}`,
            after: { customerId, duration_months, total_price: pricing.total_price },
            description: `Đăng ký hộ gói "${pkg.name}" (${duration_months} tháng, ${pricing.total_price.toLocaleString("vi-VN")} đ)`,
          });
          res
            .status(201)
            .json({ message: "Đăng ký gói tập thành công!", registration: result, pricing });
        },
      );
    })
    .catch((err) => res.status(500).json({ error: err.message }));
};

// Duyệt / từ chối đăng ký gói tập của hội viên - bao gồm cả PHIẾU GIA HẠN HỘ
export const approveRegistration = async (req, res) => {
  try {
    const { action } = req.body;
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Hành động không hợp lệ!" });
    }

    const reg = await UserPackage.findById(req.params.id)
      .populate("package_id", "name ptSessionsPerMonth isFullMonth unitPrice");
    if (!reg) return res.status(404).json({ error: "Không tìm thấy đăng ký!" });

    if (action === "reject") {
      reg.status = "đã hủy";
      if (reg.payment_status === "chờ thanh toán") reg.payment_status = "đã hủy";
      await reg.save();

      await logAudit(req, {
        action: "REGISTRATION_REJECT",
        entityType: "UserPackage",
        entityId: reg._id,
        entityName: reg.package_id?.name || "",
        description: reg.is_renewal_ticket
          ? `Từ chối phiếu gia hạn gói "${reg.package_id?.name}"`
          : `Từ chối đăng ký gói "${reg.package_id?.name}"`,
      });

      await notifyMember({
        customerId: reg.customer_id,
        title: reg.is_renewal_ticket
          ? "Phiếu gia hạn bị từ chối"
          : "Đăng ký gói tập bị từ chối",
        message: reg.is_renewal_ticket
          ? `Phiếu gia hạn gói "${reg.package_id?.name}" của bạn đã bị từ chối bởi nhân viên. Vui lòng liên hệ quầy để biết thêm chi tiết.`
          : `Đăng ký gói "${reg.package_id?.name}" của bạn đã bị từ chối. Vui lòng liên hệ quầy để biết thêm chi tiết.`,
        type: reg.is_renewal_ticket ? "package_renewed" : "booking_rejected",
        userPackageId: reg._id,
      });

      return res.json({ message: "Đã từ chối đăng ký!", data: reg });
    }

    // ===== PHIẾU GIA HẠN HỘ: duyệt là xong =====
    // Chốt ngày bắt đầu = max(now, ngày hết hạn của hợp đồng gốc) để hội viên
    // không mất ngày; tự phân bổ lại buổi PT theo tháng; đánh dấu đã thanh toán tại quầy.
    if (reg.is_renewal_ticket) {
      let baseStart = new Date();
      if (reg.original_registration_id) {
        const original = await UserPackage.findById(reg.original_registration_id).select("end_date");
        if (original?.end_date && new Date(original.end_date) > baseStart) {
          baseStart = new Date(original.end_date);
        }
      }
      if (reg.proposed_start_date && new Date(reg.proposed_start_date) > baseStart) {
        baseStart = new Date(reg.proposed_start_date);
      }

      reg.start_date = baseStart;
      reg.end_date = addMonths(baseStart, reg.duration_months);
      reg.monthlySessions = allocatePtSessions(baseStart, reg.duration_months, reg.package_id);
      reg.payment_status = "đã thanh toán";
      reg.payment_date = reg.payment_date || new Date();
      reg.confirmed_by = req.user.id;
      reg.confirmed_at = new Date();
      reg.status = "đang hoạt động";
      await reg.save();

      await logAudit(req, {
        action: "ADMIN_RENEW_APPROVE",
        entityType: "UserPackage",
        entityId: reg._id,
        entityName: reg.package_id?.name || "",
        after: {
          start_date: reg.start_date,
          end_date: reg.end_date,
          total_price: reg.total_price,
        },
        description: `Duyệt phiếu gia hạn gói "${reg.package_id?.name}" (${reg.duration_months} tháng)`,
      });

      await notifyMember({
        customerId: reg.customer_id,
        title: "Phiếu gia hạn đã được duyệt",
        message: `Phiếu gia hạn gói "${reg.package_id?.name}" (${reg.duration_months} tháng) đã được duyệt. Hiệu lực từ ${new Date(reg.start_date).toLocaleDateString("vi-VN")} đến ${new Date(reg.end_date).toLocaleDateString("vi-VN")}.`,
        type: "package_renewed",
        userPackageId: reg._id,
      });

      return res.json({ message: "Đã duyệt gia hạn! Gói của khách có hiệu lực ngay.", data: reg });
    }

    // ===== Đăng ký thường =====
    if (reg.payment_status === "đã thanh toán" && !reg.confirmed_at) {
      reg.confirmed_by = req.user?.id;
      reg.confirmed_at = new Date();
    }
    reg.status = "đang hoạt động";
    await reg.save();

    await logAudit(req, {
      action: "REGISTRATION_APPROVE",
      entityType: "UserPackage",
      entityId: reg._id,
      entityName: reg.package_id?.name || "",
      description: `Duyệt đăng ký gói "${reg.package_id?.name}"`,
    });

    // Thông báo kích hoạt kèm số buổi PT hệ thống đã TỰ phân bổ theo từng tháng
    const ptInfo = reg.isFullMonth
      ? " Gói của bạn không giới hạn buổi tập với HLV."
      : reg.ptSessionsPerMonth > 0
        ? ` Hệ thống đã tự cấp ${reg.ptSessionsPerMonth} buổi tập với HLV mỗi tháng (tổng ${reg.ptSessionsPerMonth * reg.duration_months} buổi / ${reg.duration_months} tháng) — xem chi tiết từng tháng ở mục Gói tập của tôi.`
        : "";
    await notifyMember({
      customerId: reg.customer_id,
      title: "Gói tập đã được kích hoạt",
      message: `Đăng ký gói "${reg.package_id?.name}" của bạn đã được duyệt và có hiệu lực từ ${new Date(reg.start_date).toLocaleDateString("vi-VN")} đến ${new Date(reg.end_date).toLocaleDateString("vi-VN")}.${ptInfo}`,
      type: "package_activated",
      userPackageId: reg._id,
    });

    return res.json({ message: "Đã duyệt đăng ký!", data: reg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const confirmPayment = async (req, res) => {
  updatePaymentStatus(
    req.params.id,
    { payment_status: req.body.payment_status, confirmed_by: req.user.id },
    async (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      await logAudit(req, {
        action: "PAYMENT_CONFIRM",
        entityType: "UserPackage",
        entityId: req.params.id,
        after: { payment_status: req.body.payment_status },
        description: `Xác nhận thanh toán đơn đăng ký: ${req.body.payment_status}`,
      });
      res.status(200).json({ message: "OK" });
    },
  );
};
export const setPaymentMethod = (req, res) => {
  updatePaymentMethod(
    req.params.id,
    req.user.id,
    req.body.payment_method,
    (err, result) => res.status(200).json({ message: "OK" }),
  );
};

export const createRenewOrUpgrade = async (req, res) => {
  const { package_id, locationId, duration_months, total_price, action_type, currentRegistrationId, signature, current_end_date } =
    req.body;

  if (action_type === 'upgrade') {
    try {
      if (currentRegistrationId) {
        await UserPackage.findByIdAndUpdate(currentRegistrationId, {
          status: 'đã hủy',
          payment_status: 'đã hủy'
        });
      }

      createRegistration(
        {
          customer_id: req.user.id,
          package_id,
          locationId,
          duration_months: duration_months || 1,
          total_price,
          payment_status: "chờ thanh toán",
          signature,
          start_date: new Date(),
          end_date: new Date(),
        },
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ message: "OK", registration: result });
        },
      );
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  // ===== GIA HẬN (self-service): giá do hệ thống tính theo bảng giá hiện hành =====
  try {
    const pkg = await Package.findById(package_id);
    if (!pkg) return res.status(404).json({ error: "Gói tập không tồn tại!" });
    if (pkg.lifecycle_status && pkg.lifecycle_status !== "đang bán") {
      return res.status(400).json({ error: "Gói tập này hiện không bán để gia hạn!" });
    }

    let pricing;
    try {
      pricing = computeTierPrice(pkg, duration_months);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    // Gia hạn liền mạch: còn hạn thì tính từ ngày hết hạn cũ, hết hạn rồi thì từ hôm nay
    const now = new Date();
    let start = now;
    if (current_end_date && new Date(current_end_date) > now) {
      start = new Date(current_end_date);
    } else if (!current_end_date && currentRegistrationId) {
      const cur = await UserPackage.findById(currentRegistrationId).select("end_date");
      if (cur?.end_date && new Date(cur.end_date) > now) start = new Date(cur.end_date);
    }
    const end = addMonths(start, pricing.months);

    createRegistration(
      {
        customer_id: req.user.id,
        package_id,
        locationId: locationId || pkg.locationId || null,
        duration_months: pricing.months,
        ptSessionsPerMonth: pkg.isFullMonth ? 0 : (pkg.ptSessionsPerMonth || 0),
        isFullMonth: !!pkg.isFullMonth,
        monthlySessions: allocatePtSessions(start, pricing.months, pkg),
        total_price: pricing.total_price,
        unit_price_applied: pricing.unit_price,
        price_snapshot: {
          unit_price: pricing.unit_price,
          months: pricing.months,
          discount_percent: pricing.discount_percent,
        },
        original_registration_id: currentRegistrationId || null,
        signature,
        start_date: start,
        end_date: end,
        payment_status: "chờ thanh toán",
        status: "chờ xác nhận",
      },
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        return res.status(201).json({ message: "OK", registration: result, pricing });
      },
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// PT SESSION MANAGEMENT
// ==========================================

export const getMyPtSessions = async (req, res) => {
  try {
    const targetCustomerId = (req.query.customerId && (req.user.isStaff || req.user.isAdmin)) ? req.query.customerId : req.user.id;
    const regs = await new Promise((resolve, reject) => {
      getUserPackages(targetCustomerId, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const result = [];

    for (const reg of regs) {
      if (reg.payment_status !== 'đã thanh toán') continue;
      if (reg.status === 'hết hạn' || reg.status === 'đã hủy') continue;
      const pkg = reg.package_id || {};
      const disc = pkg.disciplineId || null;
      const comboDiscs = pkg.disciplines || [];

      const monthlyEntry = (reg.monthlySessions || []).find(
        m => m.month === currentMonth && m.year === currentYear
      );

      let remaining = 0;
      if (reg.isFullMonth) {
        remaining = 999;
      } else if (reg.ptSessionsPerMonth > 0) {
        remaining = monthlyEntry ? monthlyEntry.total - monthlyEntry.used : reg.ptSessionsPerMonth;
      }

      result.push({
        registrationId: reg._id,
        packageName: pkg.name || '',
        ptSessionsPerMonth: reg.ptSessionsPerMonth,
        isFullMonth: reg.isFullMonth,
        currentMonthRemaining: remaining,
        // Lịch cấp buổi PT theo từng tháng do hệ thống tự phân bổ lúc mua/gia hạn
        monthlySchedule: (reg.monthlySessions || []).map((m) => ({
          month: m.month,
          year: m.year,
          total: m.total,
          used: m.used,
          remaining: Math.max(0, m.total - m.used),
        })),
        currentMonth,
        currentYear,
        startDate: reg.start_date,
        endDate: reg.end_date,
        disciplineId: disc ? (disc._id || disc).toString() : null,
        disciplineName: disc?.name || '',
        comboDisciplineIds: comboDiscs.map(d => (d._id || d).toString()),
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deductPtSession = async (req, res) => {
  const { registrationId, count } = req.body;
  if (!registrationId) return res.status(400).json({ error: 'Thiếu registrationId!' });

  try {
    const reg = await UserPackage.findById(registrationId);
    if (!reg) return res.status(404).json({ error: 'Không tìm thấy đăng ký!' });
    if (String(reg.customer_id?._id || reg.customer_id) !== req.user.id) {
      return res.status(403).json({ error: 'Không có quyền!' });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (reg.isFullMonth) {
      return res.json({ success: true, message: 'Full tháng - không cần trừ' });
    }

    const monthly = (reg.monthlySessions || []).find(
      m => m.month === currentMonth && m.year === currentYear
    );

    if (!monthly) {
      return res.status(400).json({ error: 'Không tìm thấy thông tin buổi tập tháng này!' });
    }

    const deductCount = count || 1;
    if (monthly.used + deductCount > monthly.total) {
      return res.status(400).json({ error: `Chỉ còn ${monthly.total - monthly.used} buổi trong tháng này!` });
    }

    await UserPackage.updateOne(
      {
        _id: registrationId,
        'monthlySessions.month': currentMonth,
        'monthlySessions.year': currentYear,
      },
      { $inc: { 'monthlySessions.$.used': deductCount } }
    );

    res.json({ success: true, remaining: monthly.total - monthly.used - deductCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// UPGRADE CALCULATION
// ==========================================

export const calculateUpgrade = async (req, res) => {
  try {
    const { currentRegistrationId, newPackageId } = req.body;
    if (!currentRegistrationId || !newPackageId) {
      return res.status(400).json({ error: 'Thiếu thông tin!' });
    }

    const currentReg = await UserPackage.findById(currentRegistrationId)
      .populate('package_id');
    if (!currentReg) return res.status(404).json({ error: 'Không tìm thấy đăng ký hiện tại!' });

    const newPkg = await Package.findById(newPackageId);
    if (!newPkg) return res.status(404).json({ error: 'Không tìm thấy gói tập mới!' });

    const now = new Date();
    const startDate = new Date(currentReg.start_date);
    const endDate = new Date(currentReg.end_date);

    if (now >= endDate) {
      return res.status(400).json({ error: 'Gói tập hiện tại đã hết hạn!' });
    }

    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const usedDays = Math.max(0, Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)));
    const remainingDays = Math.max(0, totalDays - usedDays);

    const currentDailyRate = currentReg.total_price / totalDays;
    const remainingValue = Math.floor(currentDailyRate * remainingDays);

    const newDailyRate = (newPkg.unitPrice || newPkg.price) / 30;
    const newPackageCost = Math.floor(newDailyRate * remainingDays);

    const diff = remainingValue - newPackageCost;

    res.json({
      remainingDays,
      totalDays,
      usedDays,
      remainingValue,
      newPackageCost,
      amountToPay: diff < 0 ? Math.abs(diff) : 0,
      refundAmount: diff > 0 ? diff : 0,
      refundPercentage: diff > 0 ? Math.round((diff / newPackageCost) * 100) : 0,
      currentPackage: { name: currentReg.package_id?.name, unitPrice: currentReg.package_id?.unitPrice },
      newPackage: { name: newPkg.name, unitPrice: newPkg.unitPrice },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// MEMBER TRANSACTION HISTORY
// ==========================================

export const transactionHistory = (req, res) => {
  getTransactionHistory(req.user.id, (err, transactions) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(transactions);
  });
};

// ==========================================
// VNPAY INTEGRATION USING vnpay LIBRARY
// ==========================================

export const createVnPayUrl = (req, res) => {
  const { id } = req.params;
  getRegistrationById(id, (err, reg) => {
    if (err || !reg)
      return res.status(404).json({ error: "Không tìm thấy đơn!" });

    if (reg.payment_status === "đã thanh toán")
      return res.status(400).json({ error: "Đơn đã được thanh toán!" });

    try {
      const ipAddr =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.ip ||
        "127.0.0.1";

      const amount = Math.floor(Number(reg.total_price));
      const txnRef = `GYM${id.slice(-8).toUpperCase()}${Date.now()}`;
      const returnUrl =
        process.env.VNP_RETURN_URL ||
        "http://localhost:5000/api/user-packages/vnpay-return";

      const paymentUrl = vnpay.buildPaymentUrl({
        vnp_Amount: amount,
        vnp_IpAddr: ipAddr,
        vnp_ReturnUrl: returnUrl,
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: `Thanh toan goi tap ${reg.package_id?.name || ''}`,
        vnp_Locale: 'vn',
        vnp_BankCode: '',
      });

      updateVnpayTransactionRef(id, txnRef, (updateErr) => {
        if (updateErr)
          console.error("Lỗi lưu txnRef:", updateErr.message);
      });

      res.status(200).json({ paymentUrl });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Lỗi tạo URL thanh toán: " + error.message });
    }
  });
};

export const vnpayReturn = (req, res) => {
  let verify;
  try {
    verify = vnpay.verifyReturnUrl(req.query);
  } catch (error) {
    return res.redirect(
      `${FRONTEND_URL}/dashboard/my-packages?vnpay_success=false&message=verify_error`,
    );
  }

  if (!verify.isVerified) {
    return res.redirect(
      `${FRONTEND_URL}/dashboard/my-packages?vnpay_success=false&message=invalid_signature`,
    );
  }

  const txnRef = req.query.vnp_TxnRef;
  const responseCode = req.query.vnp_ResponseCode;
  const transactionNo = req.query.vnp_TransactionNo;
  const payDate = req.query.vnp_PayDate;
  const bankCode = req.query.vnp_BankCode;

  if (responseCode === "00") {
    findRegistrationByTxnRef(txnRef, (err, reg) => {
      if (err || !reg) {
        console.error("Không tìm thấy đơn với txnRef:", txnRef);
        return res.redirect(
          `${FRONTEND_URL}/dashboard/my-packages?vnpay_success=false&message=order_not_found`,
        );
      }

      if (reg.payment_status === "đã thanh toán") {
        return res.redirect(
          `${FRONTEND_URL}/dashboard/my-packages?vnpay_success=true&message=already_paid`,
        );
      }

      updatePaymentStatus(
        reg._id,
        {
          payment_status: "đã thanh toán",
          payment_method: "vnpay",
          vnpay_txn_ref: txnRef,
          payment_date: new Date(),
          vnpay_bank_code: bankCode,
          vnpay_bank_tran_no: req.query.vnp_BankTranNo,
          vnpay_card_type: req.query.vnp_CardType,
          vnpay_transaction_no: transactionNo,
        },
        (updateErr) => {
          if (updateErr)
            console.error("Lỗi cập nhật thanh toán:", updateErr.message);
        },
      );

      creditStaffWallets(Number(reg.total_price), `Thanh toán gói tập qua VNPay - ${Number(reg.total_price).toLocaleString('vi-VN')}₫`);

      res.redirect(
        `${FRONTEND_URL}/dashboard/my-packages?vnpay_success=true&transactionNo=${transactionNo}`,
      );
    });
  } else {
    res.redirect(
      `${FRONTEND_URL}/dashboard/my-packages?vnpay_success=false&code=${responseCode}`,
    );
  }
};


export const vnpayIPN = (req, res) => {
  let verify;
  try {
    verify = vnpay.verifyIpnCall(req.query);
  } catch {
    return res.status(200).json(IpnUnknownError);
  }

  if (!verify.isVerified) {
    return res.status(200).json(IpnFailChecksum);
  }

  const txnRef = req.query.vnp_TxnRef;
  const responseCode = req.query.vnp_ResponseCode;
  const transactionAmount = Number(req.query.vnp_Amount) / 100;

  findRegistrationByTxnRef(txnRef, (err, reg) => {
    if (err || !reg) {
      return res.status(200).json(IpnOrderNotFound);
    }

    if (reg.payment_status === "đã thanh toán") {
      return res.status(200).json(IpnSuccess);
    }

    if (Math.floor(Number(reg.total_price)) !== transactionAmount) {
      return res.status(200).json(IpnInvalidAmount);
    }

    if (responseCode === "00") {
      updatePaymentStatus(
        reg._id,
        {
          payment_status: "đã thanh toán",
          payment_method: "vnpay",
          vnpay_txn_ref: txnRef,
          payment_date: new Date(),
          vnpay_bank_code: req.query.vnp_BankCode,
          vnpay_bank_tran_no: req.query.vnp_BankTranNo,
          vnpay_card_type: req.query.vnp_CardType,
          vnpay_transaction_no: req.query.vnp_TransactionNo,
        },
        (updateErr) => {
          if (updateErr) {
            return res.status(200).json(IpnUnknownError);
          }

          creditStaffWallets(transactionAmount, `Thanh toán gói tập qua VNPay (IPN) - ${transactionAmount.toLocaleString('vi-VN')}₫`);
          res.status(200).json(IpnSuccess);
        },
      );
    } else {
      res.status(200).json(IpnSuccess);
    }
  });
};

// ==========================================
// SCHEDULE CONFLICT CHECK
// ==========================================

export const checkScheduleConflict = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { disciplineId } = req.query;

    const now = new Date();

    const activePackages = await UserPackage.find({
      customer_id: customerId,
      status: { $in: ["đang hoạt động", "còn 10 ngày"] },
      payment_status: "đã thanh toán",
      end_date: { $gt: now },
    }).populate("package_id", "name disciplineId ptSessionsPerMonth isFullMonth");

    if (!activePackages || activePackages.length === 0) {
      return res.json({ hasConflict: false, conflicts: [] });
    }

    const conflictingPackages = activePackages.filter((up) => {
      if (!up.package_id) return false;
      const pkgDiscipline = up.package_id.disciplineId;
      if (!pkgDiscipline || !disciplineId) return true;
      return pkgDiscipline.toString() === disciplineId;
    });

    if (conflictingPackages.length === 0) {
      return res.json({ hasConflict: false, conflicts: [] });
    }

    const now2 = new Date();
    const upcomingBookings = await Booking.find({
      customerId,
      date: { $gte: now2 },
      status: { $in: ["pending", "confirmed"] },
    }).populate("trainerId", "fullName")
      .populate("disciplineId", "name")
      .sort({ date: 1, time: 1 })
      .limit(10);

    const conflicts = conflictingPackages.map((up) => ({
      packageId: up.package_id?._id,
      packageName: up.package_id?.name || "Gói tập",
      endDate: up.end_date,
      ptSessionsPerMonth: up.package_id?.ptSessionsPerMonth || 0,
      isFullMonth: up.package_id?.isFullMonth || false,
      remainingSessions: up.monthlySessions?.find(
        (m) => m.month === now.getMonth() + 1 && m.year === now.getFullYear()
      ),
      upcomingBookingsCount: upcomingBookings.length,
    }));

    res.json({
      hasConflict: true,
      conflicts,
      upcomingBookings: upcomingBookings.map((b) => ({
        date: b.date,
        time: b.time || b.startTime,
        trainer: b.trainerId?.fullName || "",
        discipline: b.disciplineId?.name || b.disciplineName || "",
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// CONTRACT PDF GENERATION
// ==========================================

const addVietnameseText = (doc, text, x, y, options = {}) => {
  const {
    fontSize = 11,
    fontStyle = "normal",
    maxWidth = 170,
  } = options;

  doc.setFontSize(fontSize);
  doc.setFont("NotoSans", fontStyle);

  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return lines.length;
};

export const generateContractPdf = async (req, res) => {
  try {
    const { id } = req.params;

    const reg = await UserPackage.findById(id)
      .populate({
        path: "package_id",
        populate: { path: "disciplineId", select: "name" }
      })
      .populate("customer_id", "fullName email phone")
      .populate("locationId", "title address signature");

    if (!reg) {
      return res.status(404).json({ error: "Không tìm thấy đăng ký!" });
    }

    if (
      req.user.id !== String(reg.customer_id?._id || reg.customer_id) &&
      !req.user.isAdmin
    ) {
      return res.status(403).json({ error: "Không có quyền truy cập!" });
    }

    const pkg = reg.package_id;
    const customer = reg.customer_id;
    const location = reg.locationId;

    const doc = new jsPDF();
    const pageWidth = 210;
    const margin = 20;
    let y = 20;

    const fontPathRegular = path.resolve(__dirname, "../assets/fonts/NotoSans-Regular.ttf");
    const fontPathBold = path.resolve(__dirname, "../assets/fonts/NotoSans-Bold.ttf");
    const fontBase64Regular = fs.readFileSync(fontPathRegular).toString("base64");
    const fontBase64Bold = fs.readFileSync(fontPathBold).toString("base64");
    doc.addFileToVFS("NotoSans-Regular.ttf", fontBase64Regular);
    doc.addFileToVFS("NotoSans-Bold.ttf", fontBase64Bold);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");

    doc.setFontSize(16);
    doc.setFont("NotoSans", "bold");
    doc.text("CÔNG TY TNHH ZENFITNESS", pageWidth / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(10);
    doc.setFont("NotoSans", "normal");
    doc.text(
      location?.title || "ZenFitness Gym",
      pageWidth / 2,
      y,
      { align: "center" }
    );
    if (location?.address) {
      y += 5;
      doc.text(location.address, pageWidth / 2, y, { align: "center" });
    }

    y += 12;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(18);
    doc.setFont("NotoSans", "bold");
    doc.text("HOP DONG DANG KY GOI TAP", pageWidth / 2, y, { align: "center" });
    y += 10;

    doc.setFontSize(11);
    doc.setFont("NotoSans", "normal");
    const contractDate = reg.createdAt
      ? new Date(reg.createdAt).toLocaleDateString("vi-VN")
      : new Date().toLocaleDateString("vi-VN");
    doc.text(`Ngay lap hop dong: ${contractDate}`, margin, y);
    y += 5;
    doc.text(`So hop dong: ${reg._id}`, margin, y);
    y += 12;

    doc.setFontSize(13);
    doc.setFont("NotoSans", "bold");
    doc.text("THONG TIN CAC BEN", margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("NotoSans", "bold");
    doc.text("BEN A (Ben cung cap dich vu):", margin, y);
    y += 6;
    doc.setFont("NotoSans", "normal");
    doc.text(`Ten: ZENFITNESS`, margin + 2, y);
    y += 5;
    doc.text(`Dia chi: ${location?.title || "He thong phong tap ZenFitness"}`, margin + 2, y);
    y += 5;
    if (location?.address) {
      doc.text(`Dia chi chi tiet: ${location.address}`, margin + 2, y);
      y += 5;
    }
    y += 5;

    doc.setFont("NotoSans", "bold");
    doc.text("BEN B (Hoi vien):", margin, y);
    y += 6;
    doc.setFont("NotoSans", "normal");
    doc.text(`Họ và tên: ${customer?.fullName || "Chua cap nhat"}`, margin + 2, y);
    y += 5;
    doc.text(`Email: ${customer?.email || "Chua cap nhat"}`, margin + 2, y);
    y += 5;
    doc.text(`So dien thoai: ${customer?.phone || "Chua cap nhat"}`, margin + 2, y);
    y += 12;

    doc.setFontSize(13);
    doc.setFont("NotoSans", "bold");
    doc.text("THONG TIN GOI DICH VU", margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("NotoSans", "normal");
    doc.text(`Goi tap: ${pkg?.name || "N/A"}`, margin + 2, y);
    y += 6;
    doc.text(`Thoi han: ${reg.duration_months} thang`, margin + 2, y);
    y += 6;
    if (pkg?.disciplineId) {
      doc.text(`Bo mon: ${pkg.disciplineId.name || pkg.disciplineId}`, margin + 2, y);
      y += 6;
    }
    doc.text(
      `Gia tri: ${reg.total_price?.toLocaleString("vi-VN")} VND`,
      margin + 2,
      y
    );
    y += 6;
    if (pkg?.ptSessionsPerMonth > 0 || pkg?.isFullMonth) {
      doc.text(
        `Buoi tap voi HLV: ${
          pkg.isFullMonth ? "Khong gioi han" : `${pkg.ptSessionsPerMonth} buoi/thang`
        }`,
        margin + 2,
        y
      );
      y += 6;
    }
    const startDate = reg.start_date
      ? new Date(reg.start_date).toLocaleDateString("vi-VN")
      : "";
    const endDate = reg.end_date
      ? new Date(reg.end_date).toLocaleDateString("vi-VN")
      : "";
    doc.text(`Ngay bat dau: ${startDate}`, margin + 2, y);
    y += 6;
    doc.text(`Ngay ket thuc: ${endDate}`, margin + 2, y);
    y += 12;

    // ===== BẢNG GIÁ ÁP DỤNG TẠI THỜI ĐIỂM KÝ KẾT =====
    // Bắt buộc dùng giá CHỐT LÚC MUA (price_snapshot / unit_price_applied / total_price),
    // tuyệt đối không lấy pkg.unitPrice hiện hành vì gói có thể đã đổi giá sau này.
    if (y > 225) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont("NotoSans", "bold");
    doc.text("BANG GIA AP DUNG (THEO THOI DIEM KY KET)", margin, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont("NotoSans", "normal");

    const snap = reg.price_snapshot || {};
    const unitApplied = Number(reg.unit_price_applied ?? snap.unit_price ?? pkg?.unitPrice ?? 0);
    const monthsApplied = Number(snap.months) || Number(reg.duration_months) || 1;
    const discountPct = Number(snap.discount_percent ?? 0);
    const totalDue = Number(reg.total_price ?? 0);

    doc.text(
      `Don gia/thang tai thoi diem mua: ${unitApplied.toLocaleString("vi-VN")} VND`,
      margin + 2,
      y
    );
    y += 6;
    doc.text(`So thang: ${monthsApplied}`, margin + 2, y);
    y += 6;
    if (discountPct > 0) {
      doc.text(
        `Giam gia theo bang gia cua goi: ${discountPct}%`,
        margin + 2,
        y
      );
      y += 6;
    }
    doc.setFont("NotoSans", "bold");
    doc.text(
      `Thanh tien: ${totalDue.toLocaleString("vi-VN")} VND`,
      margin + 2,
      y
    );
    doc.setFont("NotoSans", "normal");
    y += 8;
    addVietnameseText(
      doc,
      "Gia tri hop dong duoc giu nguyen theo thoi diem ky ket. Neu goi tap thay doi gia sau nay, hop dong nay khong bi dieu chinh.",
      margin + 2,
      y,
      { fontSize: 9, maxWidth: 165 }
    );
    y += 14;

    // ===== PHÂN BỔ BUỔI PT THEO TỪNG THÁNG (hệ thống tự cấp lúc mua) =====
    const ptRows = (reg.monthlySessions || []).filter(
      (m) => m.total > 0 && m.total < 999
    );
    if ((pkg?.ptSessionsPerMonth > 0 || pkg?.isFullMonth) && ptRows.length > 0) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("NotoSans", "bold");
      doc.text("PHAN BO BUOI TAP VOI HLV THEO TUNG THANG:", margin, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont("NotoSans", "normal");
      ptRows.forEach((m) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(
          `- Thang ${m.month}/${m.year}: ${m.total} buoi (con lai ${Math.max(0, m.total - m.used)})`,
          margin + 2,
          y
        );
        y += 6;
      });
      y += 6;
    }

    if (pkg?.features && pkg.features.length > 0) {
      doc.setFontSize(13);
      doc.setFont("NotoSans", "bold");
      doc.text("QUYEN LOI BAO GOM:", margin, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont("NotoSans", "normal");
      pkg.features.forEach((feature) => {
        doc.text(`- ${feature}`, margin + 2, y);
        y += 5;
      });
      y += 5;
    }

    if (pkg?.contractA) {
      doc.setFontSize(13);
      doc.setFont("NotoSans", "bold");
      doc.text("DIEU KHOAN BEN A:", margin, y);
      y += 7;
      const lines = addVietnameseText(doc, pkg.contractA, margin + 2, y, {
        fontSize: 10,
        maxWidth: 165,
      });
      y += lines * 5 + 5;
    }

    if (pkg?.contractB) {
      doc.setFontSize(13);
      doc.setFont("NotoSans", "bold");
      doc.text("DIEU KHOAN BEN B:", margin, y);
      y += 7;
      const lines = addVietnameseText(doc, pkg.contractB, margin + 2, y, {
        fontSize: 10,
        maxWidth: 165,
      });
      y += lines * 5 + 5;
    }

    if (pkg?.contractTerms) {
      doc.setFontSize(13);
      doc.setFont("NotoSans", "bold");
      doc.text("DIEU KHOAN CAM KET CHUNG:", margin, y);
      y += 7;
      const lines = addVietnameseText(doc, pkg.contractTerms, margin + 2, y, {
        fontSize: 10,
        maxWidth: 165,
      });
      y += lines * 5 + 5;
    }

    // POLICIES
    const policies = await Policy.find({}).select("title description").lean();
    if (policies.length > 0) {
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("NotoSans", "bold");
      doc.text("CHINH SACH CHUNG:", margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont("NotoSans", "normal");
      policies.forEach((policy, idx) => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFont("NotoSans", "bold");
        doc.text(`${idx + 1}. ${policy.title}`, margin + 2, y);
        y += 5;
        doc.setFont("NotoSans", "normal");
        const lines = doc.splitTextToSize(policy.description || "", 165);
        lines.forEach((line) => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(line, margin + 4, y);
          y += 5;
        });
        y += 4;
      });
      y += 5;
    }

    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    y += 5;
    doc.setFontSize(11);
    doc.setFont("NotoSans", "bold");
    doc.text("CHU KY CUA CAC BEN", margin, y);
    y += 10;

    doc.setFont("NotoSans", "normal");
    doc.setFontSize(10);
    doc.text("Dai dien BEN A:", margin, y);
    doc.text("Hoi vien (BEN B):", margin + 100, y);
    y += 5;
    doc.text("(Ky, ghi ho ten)", margin, y);
    doc.text("(Ky, ghi ho ten)", margin + 100, y);

    y += 15;

    const sigW = 55;
    const sigH = 22;

    if (location?.signature) {
      try {
        doc.addImage(location.signature, "PNG", margin, y, sigW, sigH);
      } catch {
        doc.text("Khong co chu ky", margin, y + sigH / 2);
      }
    } else {
      doc.text("Khong co chu ky", margin, y + sigH / 2);
    }

    if (reg.signature) {
      try {
        doc.addImage(reg.signature, "PNG", margin + 100, y, sigW, sigH);
      } catch {
        doc.text("Khong xac dinh", margin + 100, y + sigH / 2);
      }
    } else {
      doc.text("Khong co chu ky", margin + 100, y + sigH / 2);
    }

    y += sigH + 5;

    y += 10;
    doc.setFontSize(9);
    doc.setFont("NotoSans", "italic");
    doc.text(
      "Hop dong nay duoc lap thanh 02 ban, moi ben giu 01 ban, co gia tri phap ly nhu nhau.",
      pageWidth / 2,
      y,
      { align: "center" }
    );

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="hop-dong-${reg._id}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Lỗi tạo PDF hợp đồng:", err);
    res.status(500).json({ error: "Lỗi tạo PDF: " + err.message });
  }
};
