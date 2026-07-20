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
import vnpay from "../config/vnpayConfig.js";
import {
  IpnSuccess,
  IpnOrderNotFound,
  IpnFailChecksum,
  IpnInvalidAmount,
  IpnUnknownError,
} from "vnpay";

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
