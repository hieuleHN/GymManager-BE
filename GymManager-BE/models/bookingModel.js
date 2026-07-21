import Booking from './schemas/bookingSchema.js';

export const createBooking = async (data, callback) => {
  try {
    const booking = new Booking({
      customerId: data.customerId,
      trainerId: data.trainerId || undefined,
      date: data.date,
      time: data.time || undefined,
      startTime: data.startTime || undefined,
      endTime: data.endTime || undefined,
      disciplineId: data.disciplineId || undefined,
      disciplineName: data.disciplineName || '',
      locationId: data.locationId,
      note: data.note || '',
      status: data.status || 'pending',
      price: data.price || 0,
      paymentStatus: data.paymentStatus || 'pending',
      batchId: data.batchId || undefined
    });
    const saved = await booking.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getBookingsByTrainer = async (trainerId, date, callback) => {
  try {
    const filter = { trainerId, status: { $in: ['pending', 'confirmed'] } };
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }
    const bookings = await Booking.find(filter)
      .populate('customerId', 'fullName phone email')
      .populate('trainerId', 'fullName')
      .sort({ date: 1, time: 1 });
    callback(null, bookings);
  } catch (err) {
    callback(err);
  }
};

export const getBookingsByCustomer = async (customerId, batchId, callback) => {
  try {
    const filter = { customerId };
    if (batchId) filter.batchId = batchId;
    const bookings = await Booking.find(filter)
      .populate('trainerId', 'fullName phone disciplineId specialties')
      .populate('disciplineId', 'name')
      .populate('locationId', 'title address')
      .sort({ date: -1, time: -1 });
    callback(null, bookings);
  } catch (err) {
    callback(err);
  }
};

export const getPersonalBookingsByCustomer = async (customerId, callback) => {
  try {
    const bookings = await Booking.find({ customerId, $or: [{ trainerId: { $exists: false } }, { trainerId: null }] })
      .populate('locationId', 'title address')
      .sort({ date: -1, startTime: -1 });
    callback(null, bookings);
  } catch (err) {
    callback(err);
  }
};

export const getBookingById = async (id, callback) => {
  try {
    const booking = await Booking.findById(id)
      .populate('customerId', 'fullName phone email')
      .populate('trainerId', 'fullName phone avatar disciplineId specialties')
      .populate('disciplineId', 'name')
      .populate('locationId', 'title address')
      .populate('transferredFromTrainerId', 'fullName');
    callback(null, booking);
  } catch (err) {
    callback(err);
  }
};

export const getAllBookings = async (page = 1, limit = 20, filters = {}, callback) => {
  try {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.trainerId) query.trainerId = filters.trainerId;
    if (filters.locationId) query.locationId = filters.locationId;
    if (filters.dateFrom || filters.dateTo) {
      query.date = {};
      if (filters.dateFrom) query.date.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.date.$lte = new Date(filters.dateTo);
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Booking.find(query)
        .populate('customerId', 'fullName phone email')
        .populate('trainerId', 'fullName disciplineId specialties')
        .populate('disciplineId', 'name')
        .populate('locationId', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const updateBookingVnpayTransactionRef = async (id, txnRef, callback) => {
  try {
    await Booking.findByIdAndUpdate(id, { vnpay_txn_ref: txnRef, updatedAt: new Date() });
    callback(null);
  } catch (err) {
    callback(err);
  }
};

export const getBookingByVnpayTxnRef = async (txnRef, callback) => {
  try {
    const booking = await Booking.findOne({ vnpay_txn_ref: txnRef })
      .populate('customerId', 'fullName phone email')
      .populate('trainerId', 'fullName phone');
    callback(null, booking);
  } catch (err) {
    callback(err);
  }
};

export const updateBookingPaymentVnpay = async (id, data, callback) => {
  try {
    const update = {
      paymentMethod: 'vnpay',
      paymentStatus: 'paid',
      vnpay_bank_code: data.bankCode || '',
      vnpay_bank_tran_no: data.bankTranNo || '',
      vnpay_card_type: data.cardType || '',
      vnpay_transaction_no: data.transactionNo || '',
      payment_date: data.paymentDate || '',
      updatedAt: new Date()
    };
    const booking = await Booking.findByIdAndUpdate(id, update, { new: true });
    if (!booking) return callback({ message: 'Không tìm thấy lịch đặt!' });
    callback(null, booking);
  } catch (err) {
    callback(err);
  }
};

export const updateBookingPayment = async (id, paymentMethod, callback) => {
  try {
    const booking = await Booking.findByIdAndUpdate(id, {
      paymentMethod,
      paymentStatus: 'paid',
      updatedAt: new Date()
    }, { new: true });
    if (!booking) return callback({ message: 'Không tìm thấy lịch đặt!' });
    callback(null, booking);
  } catch (err) {
    callback(err);
  }
};

export const updateBookingStatus = async (id, status, rejectionReason = '', callback) => {
  try {
    const update = { status, updatedAt: new Date() };
    if (rejectionReason) update.rejectionReason = rejectionReason;
    const booking = await Booking.findByIdAndUpdate(id, update, { new: true })
      .populate('customerId', 'fullName phone email')
      .populate('trainerId', 'fullName');
    if (!booking) return callback({ message: 'Không tìm thấy lịch đặt!' });
    callback(null, booking);
  } catch (err) {
    callback(err);
  }
};

export const updateTransferRequest = async (id, transferData, callback) => {
  try {
    const transferStatus = 'pending_approval';
    const booking = await Booking.findById(id);
    if (!booking) return callback({ message: 'Không tìm thấy lịch đặt!' });

    const setFields = {
      transferType: transferData.transferType,
      transferReason: transferData.transferReason || '',
      transferStatus,
      updatedAt: new Date()
    };

    if (transferData.transferType === 'to_colleague') {
      setFields.transferToTrainerId = transferData.transferToTrainerId;
      if (!booking.transferredFromTrainerId) {
        setFields.transferredFromTrainerId = booking.trainerId?._id || booking.trainerId;
      }
    } else {
      setFields.transferNewDate = transferData.transferNewDate || null;
      setFields.transferNewTime = transferData.transferNewTime || '';
      setFields.transferFromDate = booking.date;
      setFields.transferFromTime = booking.time || booking.startTime || '';
    }

    const updated = await Booking.findByIdAndUpdate(id, { $set: setFields }, { new: true })
      .populate('customerId', 'fullName phone email')
      .populate('trainerId', 'fullName')
      .populate('transferToTrainerId', 'fullName')
      .populate('transferredFromTrainerId', 'fullName');
    if (!updated) return callback({ message: 'Không tìm thấy lịch đặt!' });
    callback(null, updated);
  } catch (err) {
    callback(err);
  }
};

export const approveTransferRequest = async (id, approvedBy, callback) => {
  try {
    const booking = await Booking.findById(id);
    if (!booking) return callback({ message: 'Không tìm thấy lịch đặt!' });

    const update = {
      transferStatus: 'approved',
      transferApprovedBy: approvedBy,
      transferApprovedAt: new Date(),
      updatedAt: new Date()
    };

    if (booking.transferType === 'to_colleague' && booking.transferToTrainerId) {
      update.trainerId = booking.transferToTrainerId;
    }
    if (booking.transferType === 'to_another_day') {
      if (booking.transferNewDate) update.date = booking.transferNewDate;
      if (booking.transferNewTime) {
        update.time = booking.transferNewTime;
        update.startTime = booking.transferNewTime;
        const [h, m] = booking.transferNewTime.split(':').map(Number);
        const m2 = m + 90;
        update.endTime = `${String(h + Math.floor(m2 / 60)).padStart(2, '0')}:${String(m2 % 60).padStart(2, '0')}`;
      }
    }

    const updated = await Booking.findByIdAndUpdate(id, update, { new: true })
      .populate('customerId', 'fullName phone email')
      .populate('trainerId', 'fullName')
      .populate('transferredFromTrainerId', 'fullName');
    callback(null, updated);
  } catch (err) {
    callback(err);
  }
};

export const rejectTransferRequest = async (id, rejectionReason, callback) => {
  try {
    const update = {
      transferStatus: 'rejected',
      transferRejectionReason: rejectionReason || '',
      transferApprovedBy: null,
      transferApprovedAt: null,
      updatedAt: new Date()
    };
    const booking = await Booking.findByIdAndUpdate(id, update, { new: true })
      .populate('customerId', 'fullName phone email')
      .populate('trainerId', 'fullName');
    if (!booking) return callback({ message: 'Không tìm thấy lịch đặt!' });
    callback(null, booking);
  } catch (err) {
    callback(err);
  }
};

export const getPendingTransferRequests = async (callback) => {
  try {
    const bookings = await Booking.find({ transferStatus: 'pending_approval' })
      .populate('customerId', 'fullName phone email')
      .populate('trainerId', 'fullName')
      .populate('transferToTrainerId', 'fullName')
      .sort({ updatedAt: -1 });
    callback(null, bookings);
  } catch (err) {
    callback(err);
  }
};

export const getTrainerBookings = async (trainerId, dateFrom, dateTo, callback) => {
  try {
    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);
    const hasDateFilter = dateFrom || dateTo;

    const bookings = await Booking.find({
      $or: [
        { trainerId, status: { $in: ['pending', 'confirmed'] }, ...(hasDateFilter ? { date: dateFilter } : {}) },
        { transferToTrainerId: trainerId, transferStatus: 'approved', ...(hasDateFilter ? { date: dateFilter } : {}) },
        { transferredFromTrainerId: trainerId, transferStatus: 'approved', ...(hasDateFilter ? { date: dateFilter } : {}) }
      ]
    })
      .populate('customerId', 'fullName phone email avatar')
      .populate('trainerId', 'fullName')
      .populate('transferToTrainerId', 'fullName')
      .populate('transferredFromTrainerId', 'fullName')
      .sort({ date: 1, time: 1 });
    callback(null, bookings);
  } catch (err) {
    callback(err);
  }
};

export const checkTrainerConflict = async (trainerId, date, time, excludeBookingId = null, callback) => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const query = {
      trainerId,
      date: { $gte: startOfDay, $lte: endOfDay },
      time: time,
      status: { $in: ['pending', 'confirmed'] }
    };
    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }
    const existingBooking = await Booking.findOne(query);
    callback(null, existingBooking);
  } catch (err) {
    callback(err);
  }
};

export const checkCustomerConflict = async (customerId, date, time, excludeBookingId = null, callback) => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const query = {
      customerId,
      date: { $gte: startOfDay, $lte: endOfDay },
      time: time,
      status: { $in: ['pending', 'confirmed'] }
    };
    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }
    const existingBooking = await Booking.findOne(query)
      .populate('trainerId', 'fullName');
    callback(null, existingBooking);
  } catch (err) {
    callback(err);
  }
};

export const getBookingsByLocation = async (locationId, page = 1, limit = 20, callback) => {
  try {
    const skip = (page - 1) * limit;
    const query = { locationId };
    const [data, total] = await Promise.all([
      Booking.find(query)
        .populate('customerId', 'fullName phone')
        .populate('trainerId', 'fullName phone avatar disciplineId specialties')
        .populate('disciplineId', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};
