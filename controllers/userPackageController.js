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
import WalletTransaction from "../models/schemas/walletTransactionSchema.js";
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
import { jsPDF } from "jspdf";

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

    for (const reg of regs) {
      if (reg.payment_status === "chờ thanh toán" && reg.total_price > 0) {
        const walletTx = await WalletTransaction.findOne({
          customerId: req.user.id,
          type: 'payment',
          status: 'completed',
          description: /^Thanh toán gói tập/
        }).sort({ createdAt: -1 });

        if (walletTx) {
          await UserPackage.findByIdAndUpdate(reg._id, {
            payment_status: "đã thanh toán",
            payment_method: "wallet",
            payment_date: walletTx.createdAt || new Date()
          });
          reg.payment_status = "đã thanh toán";
          reg.payment_method = "wallet";
        }
      }
    }

    res.status(200).json(regs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getRegistrationDetail = (req, res) => {
  getRegistrationById(req.params.id, (err, reg) => res.status(200).json(reg));
};
export const cancelRegistration = (req, res) => {
  cancelRegistrationById(req.params.id, (err, result) =>
    res.status(200).json({ message: "Đã hủy" }),
  );
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

export const createRenewOrUpgrade = (req, res) => {
  const { package_id, locationId, duration_months, total_price, action_type } =
    req.body;
  createRegistration(
    {
      customer_id: req.user.id,
      package_id,
      locationId,
      duration_months,
      total_price,
      payment_status: "chờ thanh toán",
      status: "đang hoạt động",
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

    for (const reg of regs) {
      if (reg.payment_status === "chờ thanh toán" && reg.total_price > 0) {
        const walletTx = await WalletTransaction.findOne({
          customerId: req.user.id,
          type: 'payment',
          status: 'completed',
          description: /^Thanh toán gói tập/
        }).sort({ createdAt: -1 });

        if (walletTx) {
          await UserPackage.findByIdAndUpdate(reg._id, {
            payment_status: "đã thanh toán",
            payment_method: "wallet",
            payment_date: walletTx.createdAt || new Date()
          });
          reg.payment_status = "đã thanh toán";
        }
      }
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const result = [];

    for (const reg of regs) {
      if (reg.payment_status !== 'đã thanh toán') continue;
      if (reg.status === 'hết hạn' || reg.status === 'đã hủy') continue;
      if (reg.ptSessionsPerMonth <= 0 && !reg.isFullMonth) continue;

      const monthly = (reg.monthlySessions || []).find(
        m => m.month === currentMonth && m.year === currentYear
      );

      const remaining = monthly ? monthly.total - monthly.used : 0;

      result.push({
        registrationId: reg._id,
        packageName: reg.package_id?.name || '',
        ptSessionsPerMonth: reg.ptSessionsPerMonth,
        isFullMonth: reg.isFullMonth,
        currentMonthRemaining: reg.isFullMonth ? 999 : remaining,
        currentMonth,
        currentYear,
        startDate: reg.start_date,
        endDate: reg.end_date
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
  doc.setFont("helvetica", fontStyle);

  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return lines.length;
};

export const generateContractPdf = async (req, res) => {
  try {
    const { id } = req.params;

    const reg = await UserPackage.findById(id)
      .populate("package_id")
      .populate("customer_id", "fullName email phone")
      .populate("locationId", "title address");

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

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("CONG TY TNHH ZENFITNESS", pageWidth / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
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
    doc.setFont("helvetica", "bold");
    doc.text("HOP DONG DANG KY GOI TAP", pageWidth / 2, y, { align: "center" });
    y += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const contractDate = reg.createdAt
      ? new Date(reg.createdAt).toLocaleDateString("vi-VN")
      : new Date().toLocaleDateString("vi-VN");
    doc.text(`Ngay lap hop dong: ${contractDate}`, margin, y);
    y += 5;
    doc.text(`So hop dong: ${reg._id}`, margin, y);
    y += 12;

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("THONG TIN CAC BEN", margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("BEN A (Ben cung cap dich vu):", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Ten: ZENFITNESS`, margin + 2, y);
    y += 5;
    doc.text(`Dia chi: ${location?.title || "He thong phong tap ZenFitness"}`, margin + 2, y);
    y += 5;
    if (location?.address) {
      doc.text(`Dia chi chi tiet: ${location.address}`, margin + 2, y);
      y += 5;
    }
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text("BEN B (Hoi vien):", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Họ và tên: ${customer?.fullName || "Chua cap nhat"}`, margin + 2, y);
    y += 5;
    doc.text(`Email: ${customer?.email || "Chua cap nhat"}`, margin + 2, y);
    y += 5;
    doc.text(`So dien thoai: ${customer?.phone || "Chua cap nhat"}`, margin + 2, y);
    y += 12;

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("THONG TIN GOI DICH VU", margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
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
    y += 6;
    doc.text(
      `Phuong thuc thanh toan: ${reg.payment_method || "Chua xac dinh"}`,
      margin + 2,
      y
    );
    y += 6;
    doc.text(
      `Trang thai thanh toan: ${reg.payment_status || "Chua xac dinh"}`,
      margin + 2,
      y
    );
    y += 12;

    if (pkg?.features && pkg.features.length > 0) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("QUYEN LOI BAO GOM:", margin, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      pkg.features.forEach((feature) => {
        doc.text(`- ${feature}`, margin + 2, y);
        y += 5;
      });
      y += 5;
    }

    if (pkg?.contractA) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
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
      doc.setFont("helvetica", "bold");
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
      doc.setFont("helvetica", "bold");
      doc.text("DIEU KHOAN CAM KET CHUNG:", margin, y);
      y += 7;
      const lines = addVietnameseText(doc, pkg.contractTerms, margin + 2, y, {
        fontSize: 10,
        maxWidth: 165,
      });
      y += lines * 5 + 5;
    }

    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    y += 5;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("CHU KY CUA CAC BEN", margin, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Dai dien BEN A:", margin, y);
    doc.text("Hoi vien (BEN B):", margin + 100, y);
    y += 5;
    doc.text("(Ky, ghi ho ten)", margin, y);
    doc.text("(Ky, ghi ho ten)", margin + 100, y);

    y += 15;
    if (reg.signature) {
      try {
        const signatureWidth = 60;
        const signatureHeight = 25;
        doc.addImage(
          reg.signature,
          "PNG",
          margin + 70,
          y,
          signatureWidth,
          signatureHeight
        );
        y += signatureHeight + 5;
      } catch {
        doc.text("Chu ky khong xac dinh", margin + 100, y);
        y += 10;
      }
    }

    y += 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
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
