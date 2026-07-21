import mongoose from 'mongoose';
import Booking from '../models/schemas/bookingSchema.js';
import Discipline from '../models/schemas/disciplineSchema.js';
import {
  createBooking,
  getBookingsByTrainer,
  getBookingsByCustomer,
  getBookingById,
  getAllBookings,
  updateBookingStatus,
  updateBookingPayment,
  checkTrainerConflict,
  checkCustomerConflict,
  getBookingsByLocation,
  updateBookingVnpayTransactionRef,
  getBookingByVnpayTxnRef,
  updateBookingPaymentVnpay,
  updateTransferRequest,
  approveTransferRequest,
  rejectTransferRequest,
  getPendingTransferRequests,
  getTrainerBookings
} from '../models/bookingModel.js';
import { createVnpayGroup, getVnpayGroupByTxnRef, markVnpayGroupPaid } from '../models/vnpayGroupModel.js';
import { createNotification } from '../models/notificationModel.js';
import { createWalletTransaction } from '../models/walletTransactionModel.js';
import Customer from '../models/schemas/customerSchema.js';
import UserPackage from '../models/schemas/userPackageSchema.js';
import vnpay from "../config/vnpayConfig.js";

const resolveDiscipline = async (disciplineId) => {
  if (!disciplineId) return { disciplineId: null, disciplineName: '' };

  const isValidObjectId = mongoose.Types.ObjectId.isValid(disciplineId);
  if (isValidObjectId) {
    const disc = await Discipline.findById(disciplineId);
    return { disciplineId, disciplineName: disc ? disc.name : '' };
  }

  const disc = await Discipline.findOne({ name: { $regex: new RegExp(`^${disciplineId}$`, 'i') } });
  if (disc) {
    return { disciplineId: disc._id, disciplineName: disc.name };
  }
  return { disciplineId: null, disciplineName: disciplineId };
};

export const create = async (req, res) => {
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

  const resolved = await resolveDiscipline(disciplineId);

  const bookingData = {
    customerId,
    trainerId: trainerId || null,
    date,
    time: time || '',
    startTime: start,
    endTime: end,
    disciplineId: resolved.disciplineId,
    disciplineName: resolved.disciplineName,
    locationId,
    note,
    price: price || 0
  };

  checkCustomerConflict(customerId, date, time, null, (err, customerConflict) => {
    if (err) {
      console.log('[BOOKING] Lỗi checkCustomerConflict:', err.message);
      return res.status(500).json({ error: 'Lỗi kiểm tra lịch: ' + err.message });
    }
    if (customerConflict) {
      console.log('[BOOKING] TRÚNG LỊCH KHÁCH HÀNG:', customerId, date, time);
      return res.status(409).json({
        error: 'Bạn đã có lịch vào thời gian này! Vui lòng chọn thời gian khác.',
        conflict: customerConflict
      });
    }
    console.log('[BOOKING] Không trùng lịch khách hàng, tiếp tục...');

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
  });
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
  const { batchId } = req.query;

  getBookingsByCustomer(customerId, batchId || null, (err, bookings) => {
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

    updateBookingStatus(id, 'rejected', rejectionReason, async (err, booking) => {
      if (err) return res.status(400).json({ error: err.message });

      const customerId = booking.customerId._id || booking.customerId;
      const refundAmount = booking.price || 0;

      if (refundAmount > 0 && (booking.paymentStatus === 'paid' || booking.paymentStatus === 'confirmed')) {
        try {
          const customer = await Customer.findById(customerId);
          if (customer) {
            const beforeBalance = customer.balance || 0;
            await Customer.findByIdAndUpdate(customerId, {
              $inc: { balance: refundAmount },
              updatedAt: new Date()
            });

            createWalletTransaction({
              customerId,
              type: 'refund',
              amount: refundAmount,
              balanceBefore: beforeBalance,
              balanceAfter: beforeBalance + refundAmount,
              status: 'completed',
              description: `Hoàn tiền buổi tập bị từ chối - ${refundAmount.toLocaleString('vi-VN')}₫`
            }, () => {});
          }
        } catch {}
      }

      if (booking.price === 0) {
        try {
          const now = new Date();
          const month = now.getMonth() + 1;
          const year = now.getFullYear();
          await UserPackage.findOneAndUpdate(
            {
              customer_id: customerId,
              payment_status: 'đã thanh toán',
              monthlySessions: { $elemMatch: { month, year, used: { $gt: 0 } } }
            },
            { $inc: { 'monthlySessions.$.used': -1 } },
            { new: true }
          );
        } catch {}
      }

      createNotification({
        recipientId: customerId,
        recipientRole: 'member',
        title: 'Lịch tập bị từ chối',
        message: `Lịch tập với HLV ${booking.trainerId?.fullName || 'HLV'} lúc ${booking.time || booking.startTime} - ${booking.date ? new Date(booking.date).toLocaleDateString('vi-VN') : ''} đã bị từ chối. Lý do: ${rejectionReason}${refundAmount > 0 ? `. Đã hoàn ${refundAmount.toLocaleString('vi-VN')}₫ vào Ví.` : ''}`,
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

    updateTransferRequest(id, { transferType, transferToTrainerId, transferReason, transferNewDate, transferNewTime }, (err, booking) => {
      if (err) return res.status(400).json({ error: err.message });

      if (transferType === 'to_colleague') {
        createNotification({
          recipientId: transferToTrainerId,
          recipientRole: 'staff',
          title: 'Chuyển lịch tập',
          message: `HLV ${booking.trainerId?.fullName || 'HLV'} đã yêu cầu chuyển lịch tập cho bạn, chờ quản lý phê duyệt.`,
          type: 'transfer_requested',
          relatedBookingId: booking._id
        }, () => {});
      }

      res.json({ message: 'Đã gửi yêu cầu chuyển lịch!', booking });
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

    if (booking.transferStatus !== 'pending_approval') {
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

      if (booking.transferType === 'to_colleague') {
        createNotification({
          recipientId: booking.trainerId?._id || booking.trainerId,
          recipientRole: 'staff',
          title: 'Lịch tập mới',
          message: `Bạn đã được nhận chuyển lịch tập từ HLV ${originalTrainerName}.`,
          type: 'booking_transferred',
          relatedBookingId: booking._id
        }, () => {});
      }

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

    if (booking.transferStatus !== 'pending_approval') {
      return res.status(400).json({ error: 'Yêu cầu chuyển lịch không thể từ chối!' });
    }

    rejectTransferRequest(id, rejectionReason || 'Quản lý từ chối yêu cầu chuyển lịch', (err, booking) => {
      if (err) return res.status(400).json({ error: err.message });

      const customerId = booking.customerId?._id || booking.customerId;
      const originalTrainerId = booking.transferredFromTrainerId?._id || booking.transferredFromTrainerId;

      createNotification({
        recipientId: customerId,
        recipientRole: 'member',
        title: 'Yêu cầu chuyển lịch bị từ chối',
        message: `Yêu cầu chuyển lịch tập của HLV ${booking.trainerId?.fullName || ''} đã bị từ chối. Lịch tập giữ nguyên.`,
        type: 'transfer_rejected',
        relatedBookingId: booking._id
      }, () => {});

      if (originalTrainerId) {
        createNotification({
          recipientId: originalTrainerId,
          recipientRole: 'staff',
          title: 'Yêu cầu chuyển lịch bị từ chối',
          message: 'Yêu cầu chuyển lịch tập của bạn đã bị quản lý từ chối.',
          type: 'transfer_rejected',
          relatedBookingId: booking._id
        }, () => {});
      }

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

export const createBulk = async (req, res) => {
  const { trainerId, slots, dates, time, startTime, endTime, disciplineId, locationId, note, price } = req.body;
  const customerId = req.user.id;

  let bookingSlots;
  if (slots && Array.isArray(slots) && slots.length > 0) {
    bookingSlots = slots.map(s => ({
      date: s.date,
      time: s.time || '',
      startTime: s.startTime || s.time || '',
      endTime: s.endTime || (s.startTime || s.time ? (() => {
        const start = s.startTime || s.time || '';
        const [h, m] = start.split(':').map(Number);
        const m2 = m + 90;
        return `${String(h + Math.floor(m2 / 60)).padStart(2, '0')}:${String(m2 % 60).padStart(2, '0')}`;
      })() : '')
    }));
  } else if (dates && Array.isArray(dates) && dates.length > 0) {
    if (trainerId && !time) {
      return res.status(400).json({ error: 'Vui lòng chọn giờ!' });
    }
    const start = startTime || time || '';
    const end = endTime || (start ? (() => {
      const [h, m] = start.split(':').map(Number);
      const m2 = m + 90;
      return `${String(h + Math.floor(m2 / 60)).padStart(2, '0')}:${String(m2 % 60).padStart(2, '0')}`;
    })() : '');
    bookingSlots = dates.map(dateStr => ({ date: dateStr, time: time || '', startTime: start, endTime: end }));
  } else {
    return res.status(400).json({ error: 'Vui lòng chọn ít nhất một ngày!' });
  }

  const batchId = `BATCH${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const resolved = await resolveDiscipline(disciplineId);

  const created = [];
  const errors = [];

  for (const slot of bookingSlots) {
    const bookingData = {
      batchId,
      customerId,
      trainerId: trainerId || null,
      date: slot.date,
      time: slot.time,
      startTime: slot.startTime,
      endTime: slot.endTime,
      disciplineId: resolved.disciplineId,
      disciplineName: resolved.disciplineName,
      locationId,
      note,
      price: price || 0
    };

    const customerConflict = await new Promise((resolve) => {
      checkCustomerConflict(customerId, slot.date, slot.time, null, (err, conflict) => {
        resolve(err ? null : conflict);
      });
    });
    if (customerConflict) {
      errors.push({ date: slot.date, time: slot.time, error: 'Bạn đã có lịch vào thời gian này!' });
      continue;
    }

    if (trainerId) {
      const conflict = await new Promise((resolve) => {
        checkTrainerConflict(trainerId, slot.date, slot.time, null, (err, conflict) => {
          resolve(err ? null : conflict);
        });
      });
      if (conflict) {
        errors.push({ date: slot.date, time: slot.time, error: 'HLV đã có lịch vào thời gian này!' });
        continue;
      }
    }

    const booking = await new Promise((resolve, reject) => {
      createBooking(bookingData, (err, booking) => {
        if (err) reject(err);
        else resolve(booking);
      });
    });

    if (trainerId) {
      createNotification({
        recipientId: trainerId,
        recipientRole: 'staff',
        title: 'Lịch tập mới',
        message: `Học viên ${req.user.fullName || 'Hội viên'} đã đặt lịch tập với bạn`,
        type: 'booking_request',
        relatedBookingId: booking._id
      }, () => {});
    }

    created.push(booking);
  }

  res.status(201).json({
    message: errors.length > 0
      ? `Đã đặt ${created.length} buổi thành công! ${errors.length} buổi bị lỗi.`
      : `Đã đặt ${created.length} buổi thành công!`,
    bookings: created,
    errors
  });
};

export const checkConflict = (req, res) => {
  const { trainerId, customerId, date, time } = req.query;

  if (!date || !time) {
    return res.status(400).json({ error: 'Thiếu thông tin kiểm tra!' });
  }

  if (!trainerId && !customerId) {
    return res.status(400).json({ error: 'Thiếu thông tin kiểm tra!' });
  }

  const checks = {};

  const checkTrainer = new Promise((resolve) => {
    if (!trainerId) return resolve();
    checkTrainerConflict(trainerId, date, time, null, (err, conflict) => {
      checks.trainerConflict = !err && !!conflict;
      checks.trainerConflictData = conflict || null;
      resolve();
    });
  });

  const checkCustomer = new Promise((resolve) => {
    if (!customerId) return resolve();
    checkCustomerConflict(customerId, date, time, null, (err, conflict) => {
      checks.customerConflict = !err && !!conflict;
      checks.customerConflictData = conflict || null;
      resolve();
    });
  });

  Promise.all([checkTrainer, checkCustomer]).then(() => {
    const hasConflict = checks.trainerConflict || checks.customerConflict;
    res.json({
      hasConflict,
      trainerConflict: checks.trainerConflict || false,
      customerConflict: checks.customerConflict || false,
      conflict: checks.trainerConflictData || checks.customerConflictData || null
    });
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

export const createBulkVnpayUrl = async (req, res) => {
  const { bookingIds, totalAmount, trainerId, disciplineId } = req.body;
  const customerId = req.user.id;

  if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
    return res.status(400).json({ error: 'Thiếu danh sách booking!' });
  }

  const amount = Math.floor(Number(totalAmount));
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Số tiền không hợp lệ!' });
  }

  try {
    const ipAddr =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const txnRef = `BATCH${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const returnUrl =
      process.env.VNP_RETURN_URL_BOOKING ||
      'http://localhost:5000/api/bookings/vnpay-return';

    const paymentUrl = vnpay.buildPaymentUrl({
      vnp_Amount: amount,
      vnp_IpAddr: ipAddr,
      vnp_ReturnUrl: returnUrl,
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Thanh toan goi PT ${bookingIds.length} buoi`,
      vnp_Locale: 'vn',
      vnp_BankCode: '',
    });

    createVnpayGroup({
      txnRef,
      bookingIds,
      totalAmount: amount,
      customerId
    }, (err) => {
      if (err) return res.status(500).json({ error: 'Lỗi lưu nhóm thanh toán!' });

      bookingIds.forEach((id) => {
        updateBookingVnpayTransactionRef(id, txnRef, () => {});
      });

      res.status(200).json({ paymentUrl, txnRef, amount });
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi tạo URL thanh toán: ' + error.message });
  }
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

  getVnpayGroupByTxnRef(vnp_TxnRef, async (groupErr, group) => {
    if (groupErr || !group) {
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
          const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?vnpay_success=true&transactionNo=${vnp_TransactionNo}&bookingId=${bookingId}`;
          return res.redirect(redirectUrl);
        });
      });
      return;
    }

    markVnpayGroupPaid(vnp_TxnRef, async (markErr) => {
      if (markErr) {
        const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?vnpay_success=false&message=update_failed`;
        return res.redirect(redirectUrl);
      }

      let firstBookingId = '';
      for (const id of group.bookingIds) {
        if (!firstBookingId) firstBookingId = id.toString();
        const payData = {
          bankCode: vnp_BankCode,
          bankTranNo: vnp_BankTranNo,
          cardType: vnp_CardType,
          transactionNo: vnp_TransactionNo,
          paymentDate: vnp_PayDate,
        };

        try {
          await new Promise((resolve, reject) => {
            updateBookingPaymentVnpay(id, payData, (updateErr) => {
              if (updateErr) reject(updateErr);
              else resolve(null);
            });
          });
        } catch {}
      }

      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?vnpay_success=true&transactionNo=${vnp_TransactionNo}&bookingId=${firstBookingId}`;
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
