import UserPackage from './schemas/userPackageSchema.js';

export const createRegistration = async (data, callback) => {
  try {
    const { customer_id, package_id, locationId, duration_months, total_price, signature, start_date, end_date } = data;
    const registration = new UserPackage({
      customer_id, package_id, locationId, duration_months,
      total_price, signature, start_date, end_date,
      status: data.status || 'chờ xác nhận'
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
      { status: 'đã hủy', payment_status: 'cancelled' },
      { new: true }
    );
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

export const updateRegistrationById = async (id, data, callback) => {
  try {
    const result = await UserPackage.findByIdAndUpdate(
      id,
      { ...data, updatedAt: new Date() },
      { new: true }
    );
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};
