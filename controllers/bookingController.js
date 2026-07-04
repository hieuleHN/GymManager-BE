import {
  createBooking,
  getBookingsByTrainer,
  getBookingsByCustomer,
  getBookingById,
  getAllBookings,
  updateBookingStatus,
  updateBookingPayment,
  checkTrainerConflict,
  getBookingsByLocation,
  updateBookingVnpayTransactionRef,
  getBookingByVnpayTxnRef,
  updateBookingPaymentVnpay
} from '../models/bookingModel.js';
import { createNotification } from '../models/notificationModel.js';
import vnpay from "../config/vnpayConfig.js";

export const create = (req, res) => {
  const { trainerId, date, time, locationId, note, price } = req.body;
  const customerId = req.user.id;

  if (!trainerId || !date || !time) {
    return res.status(400).json({ error: 'Vui lòng chọn HLV, ngày và giờ!' });
  }

  checkTrainerConflict(trainerId, date, time, null, (err, conflict) => {
    if (err) return res.status(500).json({ error: 'Lỗi kiểm tra lịch: ' + err.message });
    if (conflict) {
      return res.status(409).json({
        error: 'HLV đã có lịch vào thời gian này! Vui lòng chọn thời gian khác.',
        conflict
      });
    }

    const bookingData = {
      customerId,
      trainerId,
      date,
      time,
      locationId,
      note,
      price
    };

    createBooking(bookingData, (err, booking) => {
      if (err) return res.status(400).json({ error: err.message || 'Lỗi tạo lịch đặt!' });

      createNotification({
        recipientId: trainerId,
        recipientRole: 'staff',
        title: 'Lịch tập mới',
        message: `Học viên ${req.user.fullName || '未知'} đã đặt lịch tập với bạn`,
        type: 'booking_request',
        relatedBookingId: booking._id
      }, () => {});

      res.status(201).json({
        message: 'Đặt lịch thành công! Chờ HLV xác nhận.',
        booking
      });
    });
  });
};

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const { status, trainerId, locationId, dateFrom, dateTo } = req.query;

  const filters = {};
  if (status) filters.status = status;
  if (trainerId) filters.trainerId = trainerId;
  if (locationId) filters.locationId = locationId;
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;

  getAllBookings(page, limit, filters, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy danh sách: ' + err.message });
    res.json(result);
  });
};

export const detail = (req, res) => {
  getBookingById(req.params.id, (err, booking) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy lịch đặt!' });
    res.json(booking);
  });
};

export const getByTrainer = (req, res) => {
  const { trainerId } = req.params;
  const { date } = req.query;

  getBookingsByTrainer(trainerId, date, (err, bookings) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(bookings);
  });
};

export const getByCustomer = (req, res) => {
  const customerId = req.user.id;

  getBookingsByCustomer(customerId, (err, bookings) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(bookings);
  });
};

export const confirmBooking = (req, res) => {
  const { id } = req.params;

  updateBookingStatus(id, 'confirmed', '', (err, booking) => {
    if (err) return res.status(400).json({ error: err.message });

    createNotification({
      recipientId: booking.customerId._id || booking.customerId,
      recipientRole: 'member',
      title: 'Lịch tập được xác nhận',
      message: `Lịch tập với HLV ${booking.trainerId.fullName} lúc ${booking.time} đã được xác nhận`,
      type: 'booking_confirmed',
      relatedBookingId: booking._id
    }, () => {});

    res.json({ message: 'Đã xác nhận lịch tập!', booking });
  });
};

export const rejectBooking = (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  if (!rejectionReason) {
    return res.status(400).json({ error: 'Vui lòng nhập lý do từ chối!' });
  }

  updateBookingStatus(id, 'rejected', rejectionReason, (err, booking) => {
    if (err) return res.status(400).json({ error: err.message });

    createNotification({
      recipientId: booking.customerId._id || booking.customerId,
      recipientRole: 'member',
      title: 'Lịch tập bị từ chối',
      message: `Lịch tập với HLV ${booking.trainerId.fullName} lúc ${booking.time} đã bị từ chối. Lý do: ${rejectionReason}`,
      type: 'booking_rejected',
      relatedBookingId: booking._id
    }, () => {});

    res.json({ message: 'Đã từ chối lịch tập!', booking });
  });
};

export const checkConflict = (req, res) => {
  const { trainerId, date, time } = req.query;

  if (!trainerId || !date || !time) {
    return res.status(400).json({ error: 'Thiếu thông tin kiểm tra!' });
  }

  checkTrainerConflict(trainerId, date, time, null, (err, conflict) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ hasConflict: !!conflict, conflict });
  });
};

export const updatePayment = (req, res) => {
  const { id } = req.params;
  const { paymentMethod } = req.body;

  if (!paymentMethod) {
    return res.status(400).json({ error: 'Thiếu phương thức thanh toán!' });
  }

  updateBookingPayment(id, paymentMethod, (err, booking) => {
    if (err) return res.status(500).json({ error: err.message || 'Lỗi cập nhật thanh toán!' });
    res.json({ message: 'Cập nhật thanh toán thành công!', booking });
  });
};

export const getByLocation = (req, res) => {
  const { locationId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  getBookingsByLocation(locationId, page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

export const createBookingVnPayUrl = (req, res) => {
  const { id } = req.params;
  console.log('DEBUG createBookingVnPayUrl called with id:', id);

  getBookingById(id, (err, booking) => {
    if (err || !booking) {
      console.log('DEBUG booking not found, err:', err?.message);
      return res.status(404).json({ error: 'Không tìm thấy lịch đặt!' });
    }

    console.log('DEBUG booking found, paymentStatus:', booking.paymentStatus, 'price:', booking.price);

    if (booking.paymentStatus === 'paid')
      return res.status(400).json({ error: 'Lịch đã được thanh toán!' });

    try {
      const ipAddr =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.ip ||
        '127.0.0.1';

      const amount = Math.floor(Number(booking.price));
      const txnRef = `BOOK${id.slice(-8).toUpperCase()}${Date.now()}`;
      const returnUrl =
        process.env.VNP_RETURN_URL_BOOKING ||
        'http://localhost:5000/api/bookings/vnpay-return';

      console.log('DEBUG building VNPAY URL for amount:', amount, 'txnRef:', txnRef);

      const paymentUrl = vnpay.buildPaymentUrl({
        vnp_Amount: amount,
        vnp_IpAddr: ipAddr,
        vnp_ReturnUrl: returnUrl,
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: `Thanh toan buoi tap ${booking.date || ''}`,
        vnp_Locale: 'vn',
        vnp_BankCode: '',
      });

      console.log('DEBUG VNPAY URL generated:', paymentUrl ? 'OK (length=' + paymentUrl.length + ')' : 'NULL');

      updateBookingVnpayTransactionRef(id, txnRef, (updateErr) => {
        if (updateErr)
          console.error('Lỗi lưu txnRef cho booking:', updateErr.message);
      });

      res.status(200).json({ paymentUrl });
    } catch (error) {
      console.error('DEBUG VNPAY URL generation error:', error.message);
      res
        .status(500)
        .json({ error: 'Lỗi tạo URL thanh toán: ' + error.message });
    }
  });
};

export const bookingsVnpayReturn = (req, res) => {
  let verify;
  try {
    verify = vnpay.verifyReturnUrl(req.query);
  } catch (err) {
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?vnpay_success=false&message=verify_error`;
    return res.redirect(redirectUrl);
  }

  if (!verify.isVerified) {
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?vnpay_success=false&message=invalid_signature`;
    return res.redirect(redirectUrl);
  }

  const {
    vnp_TxnRef,
    vnp_ResponseCode,
    vnp_TransactionNo,
    vnp_BankCode,
    vnp_BankTranNo,
    vnp_CardType,
    vnp_PayDate,
  } = req.query;

  if (vnp_ResponseCode !== '00') {
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?vnpay_success=false&code=${vnp_ResponseCode}`;
    return res.redirect(redirectUrl);
  }

  getBookingByVnpayTxnRef(vnp_TxnRef, (err, booking) => {
    if (err || !booking) {
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?vnpay_success=false&message=order_not_found`;
      return res.redirect(redirectUrl);
    }

    if (booking.paymentStatus === 'paid') {
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?vnpay_success=true&message=already_paid`;
      return res.redirect(redirectUrl);
    }

    updateBookingPaymentVnpay(booking._id, {
      bankCode: vnp_BankCode,
      bankTranNo: vnp_BankTranNo,
      cardType: vnp_CardType,
      transactionNo: vnp_TransactionNo,
      paymentDate: vnp_PayDate,
    }, (updateErr) => {
      if (updateErr) {
        const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?vnpay_success=false&message=update_failed`;
        return res.redirect(redirectUrl);
      }
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?vnpay_success=true&transactionNo=${vnp_TransactionNo}`;
      return res.redirect(redirectUrl);
    });
  });
};

export const bookingsVnpayIPN = (req, res) => {
  let verify;
  try {
    verify = vnpay.verifyIpnCall(req.query);
  } catch (err) {
    return res.status(200).json({ RspCode: '97', Message: 'Verify error' });
  }

  if (!verify.isVerified) {
    return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
  }

  const { vnp_TxnRef, vnp_ResponseCode, vnp_TransactionNo, vnp_BankCode, vnp_BankTranNo, vnp_CardType, vnp_PayDate } = req.query;

  getBookingByVnpayTxnRef(vnp_TxnRef, (err, booking) => {
    if (err || !booking) {
      return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
    }

    if (booking.paymentStatus === 'paid') {
      return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
    }

    if (vnp_ResponseCode !== '00') {
      return res.status(200).json({ RspCode: '00', Message: 'Confirm success' });
    }

    updateBookingPaymentVnpay(booking._id, {
      bankCode: vnp_BankCode,
      bankTranNo: vnp_BankTranNo,
      cardType: vnp_CardType,
      transactionNo: vnp_TransactionNo,
      paymentDate: vnp_PayDate,
    }, (updateErr) => {
      if (updateErr) {
        return res.status(200).json({ RspCode: '03', Message: 'Update failed' });
      }
      return res.status(200).json({ RspCode: '00', Message: 'Confirm success' });
    });
  });
};
