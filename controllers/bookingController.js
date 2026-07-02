import {
  createBooking,
  getBookingsByTrainer,
  getBookingsByCustomer,
  getBookingById,
  getAllBookings,
  updateBookingStatus,
  checkTrainerConflict,
  getBookingsByLocation
} from '../models/bookingModel.js';
import { createNotification } from '../models/notificationModel.js';

export const create = (req, res) => {
  const { trainerId, date, time, locationId, note } = req.body;
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
      note
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

export const getByLocation = (req, res) => {
  const { locationId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  getBookingsByLocation(locationId, page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};