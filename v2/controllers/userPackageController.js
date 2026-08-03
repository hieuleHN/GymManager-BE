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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// 1. CÁC HÀM CŨ GIỮ NGUYÊN (Không sửa đổi để tránh lỗi)
export const registerPackage = (req, res) => {
  const {
    package_id,
    locationId,
    duration_months,
    total_price,
    signature,
    payment_method,
  } = req.body;
  if (!package_id || !locationId || !duration_months || !total_price)
    return res.status(400).json({ error: "Thiếu thông tin!" });
  // if (!signature || !signature.trim())
  //   return res.status(400).json({ error: "Thiếu chữ ký!" });

      Package.findById(package_id)
    .exec()
    .then((pkg) => {
      if (!pkg) return res.status(404).json({ error: "Gói không tồn tại!" });
      const start_date = new Date();
      const end_date = new Date(start_date);
      end_date.setMonth(end_date.getMonth() + duration_months);

      const ptSessionsPerMonth = pkg.isFullMonth ? 0 : (pkg.ptSessionsPerMonth || 0);
      const isFullMonth = pkg.isFullMonth || false;
      const monthlySessions = [];
      if (isFullMonth) {
        for (let i = 0; i < duration_months; i++) {
          const d = new Date(start_date);
          d.setMonth(d.getMonth() + i);
          monthlySessions.push({
            month: d.getMonth() + 1,
            year: d.getFullYear(),
            total: 999,
            used: 0
          });
        }
      } else if (ptSessionsPerMonth > 0) {
        for (let i = 0; i < duration_months; i++) {
          const d = new Date(start_date);
          d.setMonth(d.getMonth() + i);
          monthlySessions.push({
            month: d.getMonth() + 1,
            year: d.getFullYear(),
            total: ptSessionsPerMonth,
            used: 0
          });
        }
      }

      createRegistration(
        {
          customer_id: req.user.id,
          package_id,
          locationId,
          duration_months,
          ptSessionsPerMonth,
          isFullMonth,
          monthlySessions,
          total_price,
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
            .json({ message: "Đăng ký thành công!", registration: result });
        },
      );
    })
    .catch((err) => res.status(500).json({ error: err.message }));
};

export const listMyPackages = async (req, res) => {
  try {
    const regs = await new Promise((resolve, reject) => {
      getUserPackages(req.user.id, (err, result) => {
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
export const confirmPayment = (req, res) => {
  updatePaymentStatus(
    req.params.id,
    { payment_status: req.body.payment_status, confirmed_by: req.user.id },
    (err, result) => res.status(200).json({ message: "OK" }),
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
  const { package_id, locationId, duration_months, total_price, action_type, currentRegistrationId, signature } =
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

  createRegistration(
    {
      customer_id: req.user.id,
      package_id,
      locationId,
      duration_months,
      total_price,
      payment_status: "chờ thanh toán",
      status: "đang hoạt động",
      signature,
      start_date: new Date(),
      end_date: new Date(),
    },
    (err, result) =>
      res.status(201).json({ message: "OK", registration: result }),
  );
};

// ==========================================
// PT SESSION MANAGEMENT
// ==========================================

export const getMyPtSessions = async (req, res) => {
  try {
    const regs = await new Promise((resolve, reject) => {
      getUserPackages(req.user.id, (err, result) => {
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