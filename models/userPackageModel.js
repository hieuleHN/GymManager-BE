import UserPackage from './schemas/userPackageSchema.js';

export const createRegistration = async (data, callback) => {
  try {
    const { customer_id, package_id, locationId, duration_months, total_price, signature, start_date, end_date, payment_method } = data;
    const registration = new UserPackage({
      customer_id, package_id, locationId, duration_months,
      total_price, signature, start_date, end_date,
      payment_method: payment_method || '',
      payment_status: payment_method ? 'chờ thanh toán' : 'đã thanh toán',
      status: payment_method ? 'chờ thanh toán' : 'đang hoạt động'
    });
    const result = await registration.save();
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const getUserPackages = async (customerId, callback) => {
  try {
    const registrations = await UserPackage.find({ customer_id: customerId })
      .populate('package_id', 'name unitPrice features durations')
      .populate('locationId', 'title address')
      .sort({ createdAt: -1 });
    callback(null, registrations);
  } catch (err) {
    callback(err);
  }
};

export const getRegistrationById = async (id, callback) => {
  try {
    const reg = await UserPackage.findById(id)
      .populate('package_id', 'name unitPrice features durations')
      .populate('locationId', 'title address')
      .populate('customer_id', 'fullName email phone');
    if (!reg) return callback(null, null);
    callback(null, reg);
  } catch (err) {
    callback(err);
  }
};

export const cancelRegistrationById = async (id, callback) => {
  try {
    const result = await UserPackage.findByIdAndUpdate(
      id,
      { status: 'đã hủy', payment_status: 'đã hủy' },
      { new: true }
    );
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const getAllRegistrations = async (page = 1, limit = 15, filters = {}, callback) => {
  try {
    const filter = {};
    if (filters.payment_status) filter.payment_status = filters.payment_status;
    if (filters.locationId) filter.locationId = filters.locationId;
    if (filters.status) filter.status = filters.status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      UserPackage.find(filter)
        .populate('package_id', 'name unitPrice')
        .populate('locationId', 'title address')
        .populate('customer_id', 'fullName email phone')
        .populate('confirmed_by', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      UserPackage.countDocuments(filter)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const updatePaymentMethod = async (id, customerId, paymentMethod, callback) => {
  try {
    const result = await UserPackage.findOneAndUpdate(
      { _id: id, customer_id: customerId },
      { payment_method: paymentMethod, payment_status: 'chờ thanh toán' },
      { new: true }
    );
    if (!result) return callback(new Error('NotFound'));
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const updatePaymentStatus = async (id, paymentData, callback) => {
  try {
    const { payment_status, confirmed_by } = paymentData;
    const update = {
      payment_status,
      confirmed_by,
      confirmed_at: payment_status === 'đã thanh toán' ? new Date() : null,
      payment_date: payment_status === 'đã thanh toán' ? new Date() : null
    };
    if (payment_status === 'đã hủy') {
      update.status = 'đã hủy';
    }
    const result = await UserPackage.findByIdAndUpdate(id, update, { new: true });
    if (!result) return callback(new Error('NotFound'));
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};
