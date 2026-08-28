import {
  createRequest,
  getMyRequests,
  getRequests,
  getRequestById,
  getRequestByTxnRef,
  updateRequestStatus
} from '../models/serviceRequestModel.js';
import Customer from '../models/schemas/customerSchema.js';
import UserPackage from '../models/schemas/userPackageSchema.js';
import Package from '../models/schemas/packageSchema.js';
import Booking from '../models/schemas/bookingSchema.js';
import Location from '../models/schemas/locationSchema.js';
import { createWalletTransaction } from '../models/walletTransactionModel.js';
import { createNotification } from '../models/notificationModel.js';
import { creditStaffWallets } from '../utils/staffWalletHelper.js';
import { LockerV2, LOCKER_STATUS } from '../models/lockerManagementModel.js';
import vnpay from '../config/vnpayConfig.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const REFUND_SERVICE_TYPES = ['cancel-refund'];

const resolveLocationId = (req) => {
  const fromQuery = req.query.locationId || req.query.location_id || null;
  const fromHeader = req.headers['x-location-id'] || null;
  const fromStaff = req.user?.isStaff && !req.user?.isAdmin && req.user?.locationId
    ? req.user.locationId
    : null;
  return fromQuery || fromHeader || fromStaff || null;
};

export const createServiceRequest = async (req, res) => {
  try {
    const { service_type, description, data } = req.body;
    if (!service_type) {
      return res.status(400).json({ error: 'Thiếu loại dịch vụ!' });
    }

    const customer = await Customer.findById(req.user.id).select('fullName phone locationId');
    if (!customer) {
      return res.status(404).json({ error: 'Không tìm thấy hội viên!' });
    }

    // Xác định phí dịch vụ theo cấu hình của cơ sở (nếu có)
    let amount = 0;
    let paymentStatus = 'unpaid';
    let status = 'pending';
    if (customer.locationId && !REFUND_SERVICE_TYPES.includes(service_type)) {
      const location = await Location.findById(customer.locationId).select('serviceFees');
      const feeConfig = (location?.serviceFees || []).find(f => f.service_type === service_type);
      if (feeConfig && feeConfig.hasFee && Number(feeConfig.fee) > 0) {
        if (service_type === 'locker') {
          const days = Math.min(20, Math.max(2, parseInt(data?.durationDays, 10) || 1));
          amount = Math.floor(Number(feeConfig.fee) * days);
        } else {
          amount = Math.floor(Number(feeConfig.fee));
        }
        status = 'awaiting_payment';
      }
    }

    const saved = await new Promise((resolve, reject) => {
      createRequest(
        {
          customer_id: req.user.id,
          customer_name: customer.fullName || customer.account || '',
          customer_phone: customer.phone || '',
          service_type,
          description: description || '',
          data: data || {},
          location_id: customer.locationId || null,
          status,
          amount,
          payment_status: paymentStatus
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
    });

    res.status(201).json({
      message: status === 'awaiting_payment'
        ? `Yêu cầu đã được ghi nhận. Vui lòng thanh toán ${amount.toLocaleString('vi-VN')}₫ để được xử lý.`
        : 'Yêu cầu của bạn đã được gửi. Chúng tôi sẽ liên hệ với bạn sớm!',
      request: saved
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const myRequests = async (req, res) => {
  try {
    const requests = await new Promise((resolve, reject) => {
      getMyRequests(req.user.id, (err, result) => (err ? reject(err) : resolve(result)));
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const listRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const locationId = resolveLocationId(req);

    const result = await new Promise((resolve, reject) => {
      getRequests(
        {
          status: req.query.status || null,
          service_type: req.query.service_type || null,
          location_id: locationId
        },
        page,
        limit,
        (err, data) => (err ? reject(err) : resolve(data))
      );
    });

    // Đánh dấu yêu cầu chuyển cơ sở khi hội viên có lịch tập với HLV
    const changeClubRequests = (result.data || []).filter(r => r.service_type === 'change-club');
    if (changeClubRequests.length > 0) {
      const now = new Date();
      const customerIds = [...new Set(
        changeClubRequests
          .map(r => (r.customer_id?._id || r.customer_id)?.toString())
          .filter(Boolean)
      )];
      const hlvBookings = await Booking.find({
        customerId: { $in: customerIds },
        trainerId: { $ne: null },
        date: { $gte: now },
        status: { $nin: ['cancelled', 'rejected'] }
      }).select('customerId').lean();
      const memberWithHlv = new Set(hlvBookings.map(b => b.customerId?.toString()).filter(Boolean));
      result.data.forEach(r => {
        if (r.service_type !== 'change-club') return;
        const cid = (r.customer_id?._id || r.customer_id)?.toString();
        if (cid && memberWithHlv.has(cid)) {
          r.set?.('has_hlv_booking', true, { strict: false });
        }
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const applyServiceEffect = async (request) => {
  // Thuê tủ: không cần packageId, gán tủ cho hội viên khi duyệt
  if (request.service_type === 'locker') {
    const result = await completeLockerRequest(request);
    if (result.ok) return { locker: result.locker };
    return result;
  }

  // Chuyển cơ sở: không cần packageId, xử lý trước khi check regId
  if (request.service_type === 'change-club') {
    const targetClub = request.data?.targetClub;
    if (!targetClub) {
      console.error('[ServiceRequest] Thiếu cơ sở chuyển đến:', request.data);
      return;
    }
    const customer = await Customer.findByIdAndUpdate(
      request.customer_id,
      { locationId: targetClub, updatedAt: new Date() },
      { new: true }
    );
    // Cập nhật cơ sở cho toàn bộ gói tập của hội viên
    await UserPackage.updateMany(
      { customer_id: request.customer_id },
      { $set: { locationId: targetClub, updatedAt: new Date() } }
    );
    createNotification({
      recipientId: request.customer_id,
      recipientRole: 'member',
      title: 'Chuyển cơ sở thành công',
      message: `Yêu cầu chuyển cơ sở của bạn đã được duyệt. Cơ sở hiện tại của bạn đã được cập nhật.`,
      type: 'service'
    }, () => {});
    return;
  }

  const regId = request.data?.packageId || request.data?.registrationId || request.data?.userPackageId;
  if (!regId) return;

  const reg = await UserPackage.findById(regId);
  if (!reg) return;

  const now = new Date();

  if (request.service_type === 'freeze') {
    // Đóng băng theo NHÓM gói: đóng băng toàn bộ hóa đơn đang hoạt động cùng loại gói
    const months = parseInt(request.data?.duration) || 1;
    const frozenAt = new Date();
    const until = new Date(frozenAt);
    until.setMonth(until.getMonth() + months);
    const result = await UserPackage.updateMany(
      {
        customer_id: request.customer_id,
        package_id: reg.package_id,
        status: { $in: ['đang hoạt động', 'còn 10 ngày'] }
      },
      { $set: { status: 'đang tạm ngưng', frozenAt, frozenUntil: until } }
    );
    if (result.matchedCount === 0 && (reg.status === 'đang hoạt động' || reg.status === 'còn 10 ngày')) {
      reg.frozenAt = frozenAt;
      reg.frozenUntil = until;
      reg.status = 'đang tạm ngưng';
      await reg.save();
    }
  }

  if (request.service_type === 'reactivate-expired') {
    const months = parseInt(request.data?.duration) || 1;
    const end = new Date(now);
    end.setMonth(end.getMonth() + months);
    reg.start_date = now;
    reg.end_date = end;
    reg.frozenAt = null;
    reg.frozenUntil = null;
    reg.status = 'đang hoạt động';
    await reg.save();
  }

  if (request.service_type === 'activate') {
    // Kích hoạt lại theo NHÓM gói: cộng lại số ngày đã đóng băng vào hạn sử dụng
    const frozenRegs = await UserPackage.find({
      customer_id: request.customer_id,
      package_id: reg.package_id,
      status: 'đang tạm ngưng'
    });
    for (const fr of frozenRegs) {
      if (fr.frozenAt) {
        const frozenMs = now - new Date(fr.frozenAt);
        const frozenDays = Math.max(0, Math.ceil(frozenMs / 86400000));
        if (frozenDays > 0 && fr.end_date) {
          const end = new Date(fr.end_date);
          end.setDate(end.getDate() + frozenDays);
          fr.end_date = end;
        }
        fr.frozenAt = null;
        fr.frozenUntil = null;
      }
      fr.status = 'đang hoạt động';
      await fr.save();
    }
    if (frozenRegs.length === 0 && reg.frozenAt) {
      const frozenMs = now - new Date(reg.frozenAt);
      const frozenDays = Math.max(0, Math.ceil(frozenMs / 86400000));
      if (frozenDays > 0 && reg.end_date) {
        const end = new Date(reg.end_date);
        end.setDate(end.getDate() + frozenDays);
        reg.end_date = end;
      }
      reg.frozenAt = null;
      reg.frozenUntil = null;
      reg.status = 'đang hoạt động';
      await reg.save();
    }
  }

  if (request.service_type === 'cancel-refund') {
    reg.status = 'đã hủy';
    await reg.save();
  }

  if (request.service_type === 'transfer') {
    // Chuyển nhượng gói cho hội viên khác: đổi chủ sở hữu của bản đăng ký
    const recipientId = request.data?.recipientId;
    let recipient = null;
    if (recipientId) {
      recipient = await Customer.findById(recipientId);
    } else {
      const keyword = request.data?.recipient || '';
      recipient = await Customer.findOne({
        $or: [
          { phone: keyword },
          { account: keyword }
        ]
      });
    }
    if (!recipient) {
      console.error('[ServiceRequest] Không tìm thấy hội viên nhận chuyển nhượng:', request.data?.recipient);
      return;
    }

    // Chỉ cho phép chuyển nhượng trong cùng câu lạc bộ
    const senderCustomer = await Customer.findById(request.customer_id).select('locationId');
    const senderLocationId = (reg.locationId || senderCustomer?.locationId)?.toString?.();
    const recipientLocationId = recipient.locationId?.toString?.();
    if (senderLocationId && recipientLocationId && senderLocationId !== recipientLocationId) {
      console.error('[ServiceRequest] Từ chối chuyển nhượng khác câu lạc bộ:', senderLocationId, recipientLocationId);
      return;
    }

    // Chuyển toàn bộ gói cùng loại đang hoạt động sang hội viên mới
    const result = await UserPackage.updateMany(
      {
        customer_id: request.customer_id,
        package_id: reg.package_id,
        status: { $in: ['đang hoạt động', 'còn 10 ngày'] }
      },
      { $set: { customer_id: recipient._id } }
    );
    if (result.matchedCount === 0) {
      reg.customer_id = recipient._id;
      await reg.save();
    }

    createNotification({
      recipientId: recipient._id,
      recipientRole: 'member',
      title: 'Gói tập được chuyển nhượng',
      message: `Hội viên "${request.customer_name}" đã chuyển nhượng gói tập cho bạn. Hãy kiểm tra trong mục "Gói tập của tôi".`,
      type: 'service'
    }, () => {});
  }
};

// Hội viên: tạo URL thanh toán VNPay cho yêu cầu dịch vụ có phí
export const payServiceRequest = async (req, res) => {
  try {
    const request = await new Promise((resolve, reject) => {
      getRequestById(req.params.id, (err, result) => (err ? reject(err) : resolve(result)));
    });
    if (!request) return res.status(404).json({ error: 'Không tìm thấy yêu cầu!' });
    if (String(request.customer_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Không có quyền thanh toán yêu cầu này!' });
    }
    if (request.status !== 'awaiting_payment' || request.payment_status === 'paid') {
      return res.status(400).json({ error: 'Yêu cầu này không cần thanh toán hoặc đã thanh toán!' });
    }
    if (!request.amount || request.amount <= 0) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ!' });
    }

    const ipAddr =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const txnRef = `SVC${Date.now()}${request._id.toString().slice(-6)}`;
    const returnUrl =
      process.env.VNP_RETURN_URL_SERVICE ||
      'http://localhost:5000/api/service-requests/vnpay-return';

    const paymentUrl = vnpay.buildPaymentUrl({
      vnp_Amount: request.amount,
      vnp_IpAddr: ipAddr,
      vnp_ReturnUrl: returnUrl,
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Thanh toan dich vu phong tap ${request.amount}đ`,
      vnp_Locale: 'vn',
      vnp_BankCode: '',
    });

    await updateRequestStatus(
      request._id,
      { vnpay_txn_ref: txnRef },
      (err) => { if (err) throw err; }
    );

    res.json({ paymentUrl, txnRef, amount: request.amount });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tạo URL thanh toán: ' + err.message });
  }
};

// Hội viên: thanh toán phí dịch vụ bằng Ví điện tử
export const payServiceRequestByWallet = async (req, res) => {
  try {
    const request = await new Promise((resolve, reject) => {
      getRequestById(req.params.id, (err, result) => (err ? reject(err) : resolve(result)));
    });
    if (!request) return res.status(404).json({ error: 'Không tìm thấy yêu cầu!' });
    if (String(request.customer_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Không có quyền thanh toán yêu cầu này!' });
    }
    if (request.status !== 'awaiting_payment' || request.payment_status === 'paid') {
      return res.status(400).json({ error: 'Yêu cầu này không cần thanh toán hoặc đã thanh toán!' });
    }
    const amount = Math.floor(Number(request.amount));
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ!' });
    }

    const customer = await Customer.findById(req.user.id);
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng!' });
    const balance = customer.balance || 0;
    if (balance < amount) {
      return res.status(400).json({
        error: `Số dư không đủ! Cần ${amount.toLocaleString('vi-VN')}₫, hiện có ${balance.toLocaleString('vi-VN')}₫`
      });
    }

    await Customer.findByIdAndUpdate(
      req.user.id,
      { $inc: { balance: -amount }, updatedAt: new Date() }
    );

    await new Promise((resolve) => {
      createWalletTransaction({
        customerId: req.user.id,
        type: 'payment',
        amount: -amount,
        balanceBefore: balance,
        balanceAfter: balance - amount,
        status: 'completed',
        description: `Thanh toán phí dịch vụ "${request.service_type}" - ${amount.toLocaleString('vi-VN')}₫`
      }, () => resolve(null));
    });

    await updateRequestStatus(
      request._id,
      {
        status: 'pending',
        payment_status: 'paid',
        payment_method: 'wallet',
        paid_at: new Date()
      },
      (err) => { if (err) throw err; }
    );

    createNotification({
      recipientId: req.user.id,
      recipientRole: 'member',
      title: 'Thanh toán thành công',
      message: `Bạn đã thanh toán ${amount.toLocaleString('vi-VN')}₫ cho yêu cầu dịch vụ "${request.service_type}" bằng Ví điện tử.`,
      type: 'wallet_payment',
    }, () => {});

    creditStaffWallets(amount, `Thanh toán dịch vụ qua ví - ${amount.toLocaleString('vi-VN')}₫`);

    res.json({
      success: true,
      message: 'Thanh toán thành công!',
      balance: balance - amount
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lỗi thanh toán ví!' });
  }
};

// Nhân viên: đánh dấu yêu cầu đã thu tiền (chuyển khoản / thanh toán tại quầy)
export const markPaid = async (req, res) => {
  try {
    const { payment_method } = req.body;
    const request = await new Promise((resolve, reject) => {
      getRequestById(req.params.id, (err, result) => (err ? reject(err) : resolve(result)));
    });
    if (!request) return res.status(404).json({ error: 'Không tìm thấy yêu cầu!' });
    if (request.status !== 'awaiting_payment' || request.payment_status === 'paid') {
      return res.status(400).json({ error: 'Yêu cầu này không cần thanh toán hoặc đã thanh toán!' });
    }

    await updateRequestStatus(
      request._id,
      {
        status: 'pending',
        payment_status: 'paid',
        payment_method: payment_method || 'counter',
        paid_at: new Date()
      },
      (err) => { if (err) throw err; }
    );

    res.json({ message: 'Đã xác nhận thu tiền! Yêu cầu chuyển sang trạng thái chờ duyệt.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const vnpayReturn = (req, res) => {
  let verify;
  try {
    verify = vnpay.verifyReturnUrl(req.query);
  } catch (err) {
    return res.redirect(`${FRONTEND_URL}/dashboard/services?svc_pay=fail`);
  }

  if (!verify.isVerified) {
    return res.redirect(`${FRONTEND_URL}/dashboard/services?svc_pay=fail`);
  }

  const { vnp_ResponseCode, vnp_TransactionStatus, vnp_TxnRef, vnp_TransactionNo, vnp_BankCode } = req.query;

  if (vnp_ResponseCode !== '00' || vnp_TransactionStatus !== '00') {
    return res.redirect(`${FRONTEND_URL}/dashboard/services?svc_pay=fail`);
  }

  getRequestByTxnRef(vnp_TxnRef, async (err, request) => {
    if (err || !request) {
      return res.redirect(`${FRONTEND_URL}/dashboard/services?svc_pay=fail`);
    }

    if (request.payment_status === 'paid') {
      return res.redirect(`${FRONTEND_URL}/dashboard/history`);
    }

    await updateRequestStatus(
      request._id,
      {
        status: 'pending',
        payment_status: 'paid',
        payment_method: 'vnpay',
        paid_at: new Date(),
        vnpay_transaction_no: vnp_TransactionNo || '',
        vnpay_bank_code: vnp_BankCode || ''
      },
      (updateErr) => {
        if (updateErr) return res.redirect(`${FRONTEND_URL}/dashboard/services?svc_pay=fail`);
        res.redirect(`${FRONTEND_URL}/dashboard/history`);
      }
    );
  });
};

export const vnpayIPN = (req, res) => {
  res.json({ RspCode: '00', Message: 'OK' });
};

const applyRefund = async (request, refundAmount, note = '') => {
  const customer = await Customer.findByIdAndUpdate(
    request.customer_id,
    { $inc: { balance: refundAmount }, updatedAt: new Date() },
    { new: true }
  );

  await new Promise((resolve) => {
    createWalletTransaction({
      customerId: request.customer_id,
      type: 'refund',
      amount: refundAmount,
      balanceBefore: (customer?.balance || 0) - refundAmount,
      balanceAfter: customer?.balance || 0,
      status: 'completed',
      description: note || `Hoàn tiền dịch vụ "${request.service_type}" - ${refundAmount.toLocaleString('vi-VN')}₫`
    }, () => resolve(null));
  });

  await new Promise((resolve) => {
    createNotification({
      recipientId: request.customer_id,
      recipientRole: 'member',
      title: 'Hoàn tiền thành công',
      message: `Yêu cầu "${request.service_type}" ${request.service_type === 'locker' ? 'thuê tủ' : ''} của bạn không được xử lý. ${refundAmount.toLocaleString('vi-VN')}₫ đã được hoàn vào ví điện tử.`,
      type: 'wallet_topup'
    }, () => resolve(null));
  });
};

const assignLockerToRequest = async (request) => {
  const lockerId = request.data?.lockerId;
  if (!lockerId) return { ok: false, busy: false, error: 'Thiếu mã tủ thuê!' };
  const locker = await LockerV2.findById(lockerId);
  if (!locker) return { ok: false, busy: false, error: 'Không tìm thấy tủ!' };
  if (locker.status !== LOCKER_STATUS.AVAILABLE) {
    return { ok: false, busy: true, error: `Tủ ${locker.lockerNumber} đang được sử dụng!` };
  }
  locker.status = LOCKER_STATUS.OCCUPIED;
  locker.assignedType = 'MEMBER';
  locker.assignedName = request.customer_name || 'Hội viên';
  locker.assignedPhone = request.customer_phone || '';
  locker.assignedAt = new Date();
  locker.rentalDays = Math.min(20, Math.max(1, parseInt(request.data?.durationDays, 10) || 1));
  locker.rentedAt = locker.assignedAt;
  locker.note = locker.note || locker.lockerNumber;
  await locker.save();
  const { rentalDays, rentedAt } = locker;
  return { ok: true, busy: false, locker, rentalDays, rentedAt };
};

const completeLockerRequest = async (request) => {
  const result = await assignLockerToRequest(request);
  if (!result.ok) return { ok: false, ...result };
  createNotification({
    recipientId: request.customer_id,
    recipientRole: 'member',
    title: 'Thuê tủ đồ thành công',
    message: `Tủ ${result.locker.lockerNumber} đã được gán cho bạn. Hạn thuê ${request.data?.durationDays || ''} ngày.`,
    type: 'service'
  }, () => {});
  return { ok: true, locker: result.locker };
};

export const handleRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, admin_note } = req.body;
    if (!['accepted', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Hành động không hợp lệ!' });
    }

    const request = await new Promise((resolve, reject) => {
      getRequestById(id, (err, result) => (err ? reject(err) : resolve(result)));
    });
    if (!request) return res.status(404).json({ error: 'Không tìm thấy yêu cầu!' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Yêu cầu này đã được xử lý trước đó!' });
    }

    let refundAmount = 0;
    if (action === 'accepted' && request.service_type === 'cancel-refund') {
      if (request.data?.noRefund) {
        refundAmount = 0;
      } else {
        refundAmount = Math.floor(Number(req.body.refund_amount));
        if (!refundAmount || refundAmount <= 0) {
          return res.status(400).json({ error: 'Vui lòng nhập số tiền hoàn hợp lệ!' });
        }
      }
    }

    // Thuê tủ: nếu tủ đang được sử dụng => giữ yêu cầu ở trạng thái chờ,
    // sẽ tự động gán khi tủ trống (job chạy nền)
    if (action === 'accepted' && request.service_type === 'locker') {
      const lockerId = request.data?.lockerId;
      const locker = lockerId ? await LockerV2.findById(lockerId) : null;
      const busy = locker && locker.status !== LOCKER_STATUS.AVAILABLE;
      if (busy) {
        await new Promise((resolve, reject) => {
          updateRequestStatus(
            id,
            {
              admin_note: `Tủ ${request.data?.lockerNumber || ''} đang được sử dụng. Yêu cầu đang được giữ lại, sẽ tự động xử lý khi tủ trống.`,
              processed_by: req.user.id,
              processed_at: new Date()
            },
            (err, result) => {
              if (err) return reject(err);
              if (request.data) {
                request.data.lockerWaiting = true;
                request.save().catch(() => {});
              }
              resolve(result);
            }
          );
        });
        createNotification({
          recipientId: request.customer_id,
          recipientRole: 'member',
          title: 'Tủ đang được sử dụng',
          message: `Tủ ${request.data?.lockerNumber || ''} bạn đăng ký thuê đang được sử dụng. Yêu cầu của bạn vẫn được giữ lại và sẽ tự động xử lý ngay khi tủ trống.`,
          type: 'service'
        }, () => {});
        return res.status(200).json({
          message: `Tủ ${request.data?.lockerNumber || ''} đang bận. Yêu cầu vẫn được giữ lại, sẽ tự động xử lý khi tủ trống.`,
          waiting: true
        });
      }
    }

    await new Promise((resolve, reject) => {
      updateRequestStatus(
        id,
        {
          status: action,
          admin_note: admin_note || '',
          processed_by: req.user.id,
          processed_at: new Date()
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
    });

    if (action === 'accepted') {
      // Dịch vụ hoàn phí: cộng tiền hoàn vào ví hội viên
      if (request.service_type === 'cancel-refund') {
        try {
          await applyRefund(request, refundAmount, `Hoàn tiền hủy gói dịch vụ "${request.service_type}" - ${refundAmount.toLocaleString('vi-VN')}₫`);
        } catch (err) {
          console.error('[ServiceRequest] Lỗi hoàn tiền:', err.message);
        }
        await updateRequestStatus(
          id,
          {
            refund_amount: refundAmount,
            refunded_at: new Date(),
            admin_note: admin_note || `Đã hoàn ${refundAmount.toLocaleString('vi-VN')}₫ vào ví hội viên`
          },
          () => {}
        );
      }

      try {
        await applyServiceEffect(request);
      } catch (err) {
        console.error('[ServiceRequest] Lỗi cập nhật gói khi duyệt:', err.message);
      }
    }

    // Từ chối yêu cầu đã thanh toán => hoàn tiền về ví điện tử
    if (action === 'rejected' && request.payment_status === 'paid' && Number(request.amount) > 0) {
      const amount = Math.floor(Number(request.amount));
      try {
        await applyRefund(request, amount, `Hoàn tiền yêu cầu dịch vụ "${request.service_type}" bị từ chối - ${amount.toLocaleString('vi-VN')}₫`);
        await updateRequestStatus(
          id,
          {
            payment_status: 'refunded',
            refund_amount: amount,
            refunded_at: new Date(),
            admin_note: admin_note ? `${admin_note} | Đã hoàn ${amount.toLocaleString('vi-VN')}₫ vào ví hội viên` : `Đã hoàn ${amount.toLocaleString('vi-VN')}₫ vào ví hội viên`
          },
          () => {}
        );
      } catch (err) {
        console.error('[ServiceRequest] Lỗi hoàn tiền khi từ chối:', err.message);
      }
    }

    res.json({ message: action === 'accepted' ? 'Đã chấp nhận yêu cầu!' : 'Đã từ chối yêu cầu!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
