import Booking from './schemas/bookingSchema.js';

export const createBooking = async (data, callback) => {
  try {
    const booking = new Booking({
      customerId: data.customerId,
      trainerId: data.trainerId,
      date: data.date,
      time: data.time,
      locationId: data.locationId,
      note: data.note || '',
      status: 'pending',
      price: data.price || 500000
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

export const getBookingsByCustomer = async (customerId, callback) => {
  try {
    const bookings = await Booking.find({ customerId })
      .populate('trainerId', 'fullName phone')
      .populate('locationId', 'title address')
      .sort({ date: -1, time: -1 });
    callback(null, bookings);
  } catch (err) {
    callback(err);
  }
};

export const getBookingById = async (id, callback) => {
  try {
    const booking = await Booking.findById(id)
      .populate('customerId', 'fullName phone email')
      .populate('trainerId', 'fullName phone avatar')
      .populate('locationId', 'title address');
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
        .populate('trainerId', 'fullName')
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

export const getBookingsByLocation = async (locationId, page = 1, limit = 20, callback) => {
  try {
    const skip = (page - 1) * limit;
    const query = { locationId };
    const [data, total] = await Promise.all([
      Booking.find(query)
        .populate('customerId', 'fullName phone')
        .populate('trainerId', 'fullName phone avatar')
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
