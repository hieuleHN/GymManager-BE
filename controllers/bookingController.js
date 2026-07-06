import Booking from '../models/schemas/bookingSchema.js';
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
  updateBookingPaymentVnpay,
  updateTransferRequest,
  approveTransferRequest,
  rejectTransferRequest,
  colleagueConfirmTransfer,
  getPendingTransferRequests,
  getTrainerBookings
} from '../models/bookingModel.js';
import { createNotification } from '../models/notificationModel.js';
import vnpay from "../config/vnpayConfig.js";

export const create = (req, res) => {
  const { trainerId, date, time, startTime, endTime, disciplineId, locationId, note, price } = req.body;
  const customerId = req.user.id;

  if (!date) {
    return res.status(400).json({ error: 'Vui lòng chọn ngày!' });
  }

  if (trainerId && !time) {
    return res.status(400).json({ error: 'Vui lòng chọn giờ!' });
  }

  if (!trainerId && !time) {
    return res.status(400).json({ error: 'Vui lòng chọn giờ!' });
  }

  const start = startTime || time || '';
  const end = endTime || (start ? (() => {
    const [h, m] = start.split(':').map(Number);
    const m2 = m + 90;
    return `${String(h + Math.floor(m2 / 60)).padStart(2, '0')}:${String(m2 % 60).padStart(2, '0')}`;
  })() : '');

  const bookingData = {
    customerId,
    trainerId: trainerId || null,
    date,
    time: time || '',
    startTime: start,
    endTime: end,
    disciplineId: disciplineId || null,
    locationId,
    note,
    price: price || 0
  };

  if (trainerId) {
    checkTrainerConflict(trainerId, date, time, null, (err, conflict) => {
      if (err) return res.status(500).json({ error: 'Lỗi kiểm tra lịch: ' + err.message });
      if (conflict) {
        return res.status(409).json({
          error: 'HLV đã có lịch vào thời gian này! Vui lòng chọn thời gian khác.',
          conflict
        });
      }

      createBooking(bookingData, (err, booking) => {
        if (err) return res.status(400).json({ error: err.message || 'Lỗi tạo lịch đặt!' });

        createNotification({
          recipientId: trainerId,
          recipientRole: 'staff',
          title: 'Lịch tập mới',
          message: `Học viên ${req.user.fullName || 'Hội viên'} đã đặt lịch tập với bạn`,
          type: 'booking_request',
          relatedBookingId: booking._id
        }, () => {});

        res.status(201).json({
          message: 'Đặt lịch thành công! Chờ HLV xác nhận.',
          booking
        });
      });
    });
  } else {
    const personalBookingData = {
      ...bookingData,
      paymentStatus: 'paid',
      status: 'confirmed'
    };
    createBooking(personalBookingData, (err, booking) => {
      if (err) return res.status(400).json({ error: err.message || 'Lỗi tạo lịch đặt!' });
      res.status(201).json({
        message: 'Đặt lịch thành công!',
        booking
      });
    });
  }
};

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const { status, trainerId, locationId, dateFrom, dateTo } = req.query;

  const filters = {};
  if (status) filters.status = status;
  if (locationId) filters.locationId = locationId;
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;

  // Tu dong loc theo tai khoan HLV dang nhap, admin thi xem tat ca
  if (!req.user.isAdmin) {
    filters.trainerId = req.user.id;
  } else if (trainerId) {
    filters.trainerId = trainerId;
  }

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

    const result = (bookings || []).map(b => ({
      _id: b._id,
      time: b.time,
      startTime: b.startTime,
      endTime: b.endTime,
      date: b.date,
      status: b.status,
      trainerId: b.trainerId ? { _id: b.trainerId._id, fullName: b.trainerId.fullName } : null,
      customerId: req.user.isAdmin || trainerId === req.user.id
        ? b.customerId
        : undefined
    }));

    res.json(result);
  });
};

export const getByCustomer = (req, res) => {
  const customerId = req.user.id;

  getBookingsByCustomer(customerId, (err, bookings) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(bookings);
  });
};

const canManageBooking = (user, booking) => {
  if (user.isAdmin) return true;
  if (user.isStaff && user.role === 'staff' && !user.jobId) return true;
  if (booking.trainerId) {
    const trainerId = booking.trainerId._id || booking.trainerId;
    if (trainerId.toString() === user.id) return true;
  }
  return false;
};

export const confirmBooking = (req, res) => {
  const { id } = req.params;

  getBookingById(id, (err, booking) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy lịch đặt!' });

    if (!canManageBooking(req.user, booking)) {
      return res.status(403).json({ error: 'Bạn không có quyền xác nhận lịch tập này!' });
    }

    updateBookingStatus(id, 'confirmed', '', (err, booking) => {
      if (err) return res.status(400).json({ error: err.message });

      createNotification({
        recipientId: booking.customerId._id || booking.customerId,
        recipientRole: 'member',
        title: 'Lịch tập được xác nhận',
        message: `Lịch tập với HLV ${booking.trainerId?.fullName || 'HLV'} lúc ${booking.time || booking.startTime} đã được xác nhận`,
        type: 'booking_confirmed',
        relatedBookingId: booking._id
      }, () => {});

      res.json({ message: 'Đã xác nhận lịch tập!', booking });
    });
  });
};

export const rejectBooking = (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  if (!rejectionReason) {
    return res.status(400).json({ error: 'Vui lòng nhập lý do từ chối!' });
  }

  getBookingById(id, (err, booking) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy lịch đặt!' });

    if (!canManageBooking(req.user, booking)) {
      return res.status(403).json({ error: 'Bạn không có quyền từ chối lịch tập này!' });
    }

    updateBookingStatus(id, 'rejected', rejectionReason, (err, booking) => {
      if (err) return res.status(400).json({ error: err.message });

      createNotification({
        recipientId: booking.customerId._id || booking.customerId,
        recipientRole: 'member',
        title: 'Lịch tập bị từ chối',
        message: `Lịch tập với HLV ${booking.trainerId?.fullName || 'HLV'} lúc ${booking.time || booking.startTime} đã bị từ chối. Lý do: ${rejectionReason}`,
        type: 'booking_rejected',
        relatedBookingId: booking._id
      }, () => {});

      res.json({ message: 'Đã từ chối lịch tập!', booking });
    });
  });
};

export const requestTransfer = (req, res) => {
  const { id } = req.params;
  const { transferType, transferToTrainerId, transferReason, transferNewDate, transferNewTime } = req.body;

  if (!transferType || !['to_colleague', 'to_another_day'].includes(transferType)) {
    return res.status(400).json({ error: 'Loại chuyển lịch không hợp lệ!' });
  }

  if (transferType === 'to_colleague' && !transferToTrainerId) {
    return res.status(400).json({ error: 'Vui lòng chọn đồng nghiệp!' });
  }

  if (transferType === 'to_another_day' && !transferNewDate) {
    return res.status(400).json({ error: 'Vui lòng chọn ngày mới!' });
  }

  getBookingById(id, (err, booking) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy lịch đặt!' });

    const trainerId = booking.trainerId?._id || booking.trainerId;
    if (trainerId?.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Bạn không có quyền yêu cầu chuyển lịch này!' });
    }

    if (transferType === 'to_another_day') {
      const newTime = transferNewTime || booking.time || booking.startTime || '';
      const [h, m] = newTime.split(':').map(Number);
      const m2 = m + 90;
      const endTime = `${String(h + Math.floor(m2 / 60)).padStart(2, '0')}:${String(m2 % 60).padStart(2, '0')}`;

      const update = {
        date: new Date(transferNewDate),
        time: newTime,
        startTime: newTime,
        endTime,
        transferType: 'to_another_day',
        transferReason: transferReason || '',
        transferNewDate: new Date(transferNewDate),
        transferNewTime: newTime,
        transferStatus: 'approved',
        updatedAt: new Date()
      };

      Booking.findByIdAndUpdate(id, update, { new: true })
        .populate('customerId', 'fullName phone email')
        .populate('trainerId', 'fullName')
        .then(updated => {
          if (!updated) return res.status(404).json({ error: 'Không tìm thấy lịch đặt!' });

          createNotification({
            recipientId: updated.customerId?._id || updated.customerId,
            recipientRole: 'member',
            title: 'Chuyển lịch tập',
            message: `Lịch tập của bạn đã được chuyển sang ngày ${new Date(transferNewDate).toLocaleDateString('vi-VN')} lúc ${newTime}. Lý do: ${transferReason || 'HLV bận'}`,
            type: 'booking_transferred',
            relatedBookingId: updated._id
          }, () => {});

          res.json({ message: 'Đã chuyển lịch tập thành công!', booking: updated });
        })
        .catch(err => res.status(500).json({ error: err.message }));
      return;
    }

    updateTransferRequest(id, { transferType, transferToTrainerId, transferReason, transferNewDate, transferNewTime }, (err, booking) => {
      if (err) return res.status(400).json({ error: err.message });

      if (transferType === 'to_colleague') {
        createNotification({
          recipientId: transferToTrainerId,
          recipientRole: 'staff',
          title: 'Yêu cầu chuyển lịch tập',
          message: `HLV ${booking.trainerId?.fullName || 'HLV'} muốn chuyển lịch tập cho bạn. Vui lòng xác nhận.`,
          type: 'transfer_requested',
          relatedBookingId: booking._id
        }, () => {});
      }

      res.json({ message: 'Đã gửi yêu cầu chuyển lịch!', booking });
    });
  });
};

export const colleagueConfirm = (req, res) => {
  const { id } = req.params;
  const { accept } = req.body;

  getBookingById(id, (err, booking) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy lịch đặt!' });

    if (booking.transferStatus !== 'pending_colleague') {
      return res.status(400).json({ error: 'Yêu cầu chuyển lịch không ở trạng thái chờ đồng nghiệp!' });
    }

    const pendingIds = (booking.pendingColleagueIds || []).map(p => {
      const id = p?._id?.toString?.() || p?.toString?.();
      return id;
    }).filter(Boolean);
    if (!pendingIds.includes(req.user.id)) {
      return res.status(403).json({ error: 'Bạn không có quyền xác nhận yêu cầu này!' });
    }

    colleagueConfirmTransfer(id, accept, req.user.id, (err, booking) => {
      if (err) return res.status(400).json({ error: err.message });

      const customerId = booking.customerId?._id || booking.customerId;
      const originalTrainerId = booking.transferredFromTrainerId?._id || booking.transferredFromTrainerId;

      if (accept) {
        const newTrainerName = booking.trainerId?.fullName || 'HLV mới';
        const originalTrainerName = booking.transferredFromTrainerId?.fullName || 'HLV';

        createNotification({
          recipientId: customerId,
          recipientRole: 'member',
          title: 'Chuyển lịch tập thành công',
          message: `Lịch tập của bạn đã được chuyển sang HLV ${newTrainerName} do HLV ${originalTrainerName} chuyển.`,
          type: 'booking_transferred',
          relatedBookingId: booking._id
        }, () => {});
        createNotification({
          recipientId: originalTrainerId,
          recipientRole: 'staff',
          title: 'Chuyển lịch tập thành công',
          message: `Đồng nghiệp đã xác nhận nhận lịch tập của bạn.`,
          type: 'transfer_approved',
          relatedBookingId: booking._id
        }, () => {});
        res.json({ message: 'Bạn đã xác nhận nhận lịch tập thành công!', booking });
      } else {
        createNotification({
          recipientId: originalTrainerId,
          recipientRole: 'staff',
          title: 'Yêu cầu chuyển lịch bị từ chối',
          message: 'Đồng nghiệp đã từ chối nhận chuyển lịch tập của bạn.',
          type: 'transfer_rejected',
          relatedBookingId: booking._id
        }, () => {});

        const remainingPending = (booking.pendingColleagueIds || []).length;
        if (remainingPending === 0) {
          createNotification({
            recipientId: originalTrainerId,
            recipientRole: 'staff',
            title: 'Tất cả đồng nghiệp đã từ chối',
            message: 'Tất cả đồng nghiệp đã từ chối nhận chuyển lịch tập của bạn.',
            type: 'transfer_rejected',
            relatedBookingId: booking._id
          }, () => {});
        }

        res.json({ message: 'Bạn đã từ chối nhận lịch tập!', booking });
      }
    });
  });
};

export const approveTransfer = (req, res) => {
  const { id } = req.params;

  getBookingById(id, (err, booking) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy lịch đặt!' });

    if (!req.user.isAdmin && !req.user.isStaff) {
      return res.status(403).json({ error: 'Bạn không có quyền phê duyệt!' });
    }

    if (!['pending_approval', 'pending_colleague'].includes(booking.transferStatus)) {
      return res.status(400).json({ error: 'Yêu cầu chuyển lịch không thể phê duyệt!' });
    }

    approveTransferRequest(id, req.user.id, (err, booking) => {
      if (err) return res.status(400).json({ error: err.message });

      const customerId = booking.customerId?._id || booking.customerId;

      const originalTrainerId = booking.transferredFromTrainerId?._id || booking.transferredFromTrainerId;
      const originalTrainerName = booking.transferredFromTrainerId?.fullName || 'HLV';

      createNotification({
        recipientId: customerId,
        recipientRole: 'member',
        title: 'Lịch tập đã được thay đổi',
        message: booking.transferType === 'to_colleague'
          ? `Lịch tập của bạn đã được chuyển sang HLV ${booking.trainerId?.fullName || 'mới'} do HLV ${originalTrainerName} chuyển.`
          : `Lịch tập của bạn đã được chuyển sang ngày ${booking.transferNewDate ? new Date(booking.transferNewDate).toLocaleDateString('vi-VN') : ''} lúc ${booking.transferNewTime || booking.time}`,
        type: 'booking_transferred',
        relatedBookingId: booking._id
      }, () => {});

      if (originalTrainerId) {
        createNotification({
          recipientId: originalTrainerId,
          recipientRole: 'staff',
          title: 'Yêu cầu chuyển lịch đã được phê duyệt',
          message: 'Yêu cầu chuyển lịch tập của bạn đã được quản lý phê duyệt.',
          type: 'transfer_approved',
          relatedBookingId: booking._id
        }, () => {});
      }

      createNotification({
        recipientId: booking.trainerId?._id || booking.trainerId,
        recipientRole: 'staff',
        title: 'Lịch tập mới',
        message: `Bạn đã được nhận chuyển lịch tập từ HLV ${originalTrainerName}.`,
        type: 'booking_transferred',
        relatedBookingId: booking._id
      }, () => {});

      res.json({ message: 'Đã phê duyệt chuyển lịch!', booking });
    });
  });
};

export const rejectTransfer = (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  getBookingById(id, (err, booking) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy lịch đặt!' });

    if (!req.user.isAdmin && !req.user.isStaff) {
      return res.status(403).json({ error: 'Bạn không có quyền từ chối!' });
    }

    if (!['pending_colleague', 'pending_approval'].includes(booking.transferStatus)) {
      return res.status(400).json({ error: 'Yêu cầu chuyển lịch không thể từ chối!' });
    }

    rejectTransferRequest(id, rejectionReason || 'Quản lý từ chối yêu cầu chuyển lịch', (err, booking) => {
      if (err) return res.status(400).json({ error: err.message });

      const customerId = booking.customerId?._id || booking.customerId;

      createNotification({
        recipientId: customerId,
        recipientRole: 'member',
        title: 'Yêu cầu chuyển lịch bị từ chối',
        message: `Yêu cầu chuyển lịch tập của HLV ${booking.trainerId?.fullName || ''} đã bị từ chối. Lịch tập giữ nguyên.`,
        type: 'transfer_rejected',
        relatedBookingId: booking._id
      }, () => {});

      res.json({ message: 'Đã từ chối yêu cầu chuyển lịch!', booking });
    });
  });
};

export const listTransferRequests = (req, res) => {
  getPendingTransferRequests((err, bookings) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(bookings);
  });
};

export const getMyTrainerBookings = (req, res) => {
  const trainerId = req.user.id;
  const { dateFrom, dateTo } = req.query;

  getTrainerBookings(trainerId, dateFrom, dateTo, (err, bookings) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(bookings);
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

        const dateStr = booking.date instanceof Date
        ? booking.date.toISOString().split('T')[0]
        : String(booking.date || '');

      console.log('DEBUG building VNPAY URL for amount:', amount, 'txnRef:', txnRef, 'orderInfo:', `Thanh toan buoi tap ${dateStr}`, 'returnUrl:', returnUrl);

      const paymentUrl = vnpay.buildPaymentUrl({
        vnp_Amount: amount,
        vnp_IpAddr: ipAddr,
        vnp_ReturnUrl: returnUrl,
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: `Thanh toan buoi tap ${dateStr}`,
        vnp_Locale: 'vn',
        vnp_BankCode: '',
      });

      console.log('DEBUG VNPAY URL generated:', paymentUrl);

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

    const bookingId = booking._id.toString();

    if (booking.paymentStatus === 'paid') {
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?vnpay_success=true&message=already_paid&bookingId=${bookingId}`;
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
      const bookingId = booking._id.toString();
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?vnpay_success=true&transactionNo=${vnp_TransactionNo}&bookingId=${bookingId}`;
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
