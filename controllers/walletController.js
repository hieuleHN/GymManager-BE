import Customer from '../models/schemas/customerSchema.js';
import { createWalletTransaction, getWalletTransactionByTxnRef, markTransactionCompleted, getTransactionsByCustomer } from '../models/walletTransactionModel.js';
import { updateBookingPayment } from '../models/bookingModel.js';
import { updatePaymentStatus } from '../models/userPackageModel.js';
import { createNotification } from '../models/notificationModel.js';
import vnpay from '../config/vnpayConfig.js';

export const pay = async (req, res) => {
  const { type, ids, totalAmount } = req.body;
  const customerId = req.user.id;

  if (!type || !ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Thiếu thông tin thanh toán!' });
  }

  const amount = Math.floor(Number(totalAmount));
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Số tiền không hợp lệ!' });
  }

  try {
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng!' });

    const balance = customer.balance || 0;
    if (balance < amount) {
      return res.status(400).json({
        error: `Số dư không đủ! Cần ${amount.toLocaleString('vi-VN')}₫, hiện có ${balance.toLocaleString('vi-VN')}₫`
      });
    }

    await Customer.findByIdAndUpdate(customerId, {
      $inc: { balance: -amount },
      updatedAt: new Date()
    });

    await new Promise((resolve) => {
      createWalletTransaction({
        customerId,
        type: 'payment',
        amount: -amount,
        balanceBefore: balance,
        balanceAfter: balance - amount,
        status: 'completed',
        description: type === 'booking'
          ? `Thanh toán đặt lịch (${ids.length} buổi) - ${amount.toLocaleString('vi-VN')}₫`
          : `Thanh toán gói tập - ${amount.toLocaleString('vi-VN')}₫`
      }, () => resolve(null));
    });

    if (type === 'booking') {
      for (const id of ids) {
        await new Promise((resolve) => {
          updateBookingPayment(id, 'wallet', (err) => resolve(null));
        });
      }
    } else if (type === 'package') {
      for (const id of ids) {
        await new Promise((resolve) => {
          updatePaymentStatus(id, {
            payment_status: 'đã thanh toán',
            payment_method: 'wallet'
          }, (err) => resolve(null));
        });
      }
    }

    createNotification({
      recipientId: customerId,
      recipientRole: 'member',
      title: 'Thanh toán thành công',
      message: type === 'booking'
        ? `Bạn đã thanh toán ${amount.toLocaleString('vi-VN')}₫ cho ${ids.length} buổi tập bằng Ví điện tử.`
        : `Bạn đã thanh toán ${amount.toLocaleString('vi-VN')}₫ cho gói tập bằng Ví điện tử.`,
      type: 'wallet_payment',
    }, () => {});

    res.json({
      success: true,
      message: 'Thanh toán thành công!',
      balance: balance - amount
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lỗi thanh toán ví!' });
  }
};

export const topup = async (req, res) => {
  const { amount } = req.body;
  const customerId = req.user.id;

  const numAmount = Math.floor(Number(amount));
  if (!numAmount || numAmount < 10000) {
    return res.status(400).json({ error: 'Số tiền nạp tối thiểu 10.000₫' });
  }

  try {
    const ipAddr =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const txnRef = `WALLET${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const returnUrl =
      process.env.VNP_RETURN_URL_WALLET ||
      'http://localhost:5000/api/wallet/vnpay-return';

    const paymentUrl = vnpay.buildPaymentUrl({
      vnp_Amount: numAmount,
      vnp_IpAddr: ipAddr,
      vnp_ReturnUrl: returnUrl,
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Nap tien vi ${numAmount}đ`,
      vnp_Locale: 'vn',
      vnp_BankCode: '',
    });

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng!' });

    createWalletTransaction({
      customerId,
      type: 'topup',
      amount: numAmount,
      balanceBefore: customer.balance || 0,
      balanceAfter: (customer.balance || 0) + numAmount,
      status: 'pending',
      vnpayTxnRef: txnRef,
      description: `Nạp tiền ví ${numAmount.toLocaleString('vi-VN')}đ`
    }, (err) => {
      if (err) return res.status(500).json({ error: 'Lỗi tạo giao dịch!' });
      res.json({ paymentUrl, txnRef, amount: numAmount });
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi tạo URL thanh toán: ' + error.message });
  }
};

export const vnpayReturn = (req, res) => {
  let verify;
  try {
    verify = vnpay.verifyReturnUrl(req.query);
  } catch (err) {
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?wallet_topup=fail`;
    return res.redirect(redirectUrl);
  }

  if (!verify.isVerified) {
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?wallet_topup=fail`;
    return res.redirect(redirectUrl);
  }

  const {
    vnp_ResponseCode, vnp_TransactionStatus, vnp_TxnRef,
    vnp_TransactionNo, vnp_BankCode, vnp_BankTranNo,
    vnp_CardType, vnp_PayDate,
  } = req.query;

  if (vnp_ResponseCode !== '00' || vnp_TransactionStatus !== '00') {
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?wallet_topup=fail`;
    return res.redirect(redirectUrl);
  }

  getWalletTransactionByTxnRef(vnp_TxnRef, async (err, tx) => {
    if (err || !tx) {
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?wallet_topup=fail`;
      return res.redirect(redirectUrl);
    }

    if (tx.status === 'completed') {
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?wallet_topup=success&amount=${tx.amount}`;
      return res.redirect(redirectUrl);
    }

    markTransactionCompleted(tx._id, {
      vnpayTransactionNo: vnp_TransactionNo,
      vnpayBankCode: vnp_BankCode,
      vnpayBankTranNo: vnp_BankTranNo,
      vnpayCardType: vnp_CardType,
      vnpayPayDate: vnp_PayDate,
    }, async (updateErr) => {
      if (updateErr) {
        const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?wallet_topup=fail`;
        return res.redirect(redirectUrl);
      }

      const customer = await Customer.findByIdAndUpdate(tx.customerId, {
        $inc: { balance: tx.amount },
        updatedAt: new Date()
      }, { new: true });

      createNotification({
        recipientId: tx.customerId,
        recipientRole: 'member',
        title: 'Nạp tiền thành công',
        message: `Bạn đã nạp ${(tx.amount || 0).toLocaleString('vi-VN')}₫ vào ví. Số dư hiện tại: ${(customer?.balance || 0).toLocaleString('vi-VN')}₫`,
        type: 'wallet_topup',
      }, () => {});

      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?wallet_topup=success&amount=${tx.amount}`;
      return res.redirect(redirectUrl);
    });
  });
};

export const vnpayIPN = (req, res) => {
  res.json({ RspCode: '00', Message: 'OK' });
};

export const getBalance = async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.id).select('balance');
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng!' });
    res.json({ balance: customer.balance || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getTransactions = (req, res) => {
  getTransactionsByCustomer(req.user.id, (err, txs) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(txs || []);
  });
};
