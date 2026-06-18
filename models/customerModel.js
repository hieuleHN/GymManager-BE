import Customer from './schemas/customerSchema.js';
import Staff from './schemas/staffSchema.js';
import bcrypt from 'bcryptjs';

export const createCustomer = async (data, callback) => {
  try {
    const { account, password, fullName, gender, phone, email, address, idNumber, idCardFront, idCardBack, locationId } = data;
    const existing = await Customer.findOne({ $or: [{ account }, { email }, { phone }] });
    if (existing) return callback({ message: 'Tài khoản, email hoặc số điện thoại đã tồn tại!' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const customer = new Customer({
      account, password: hashedPassword, fullName, gender, phone, email, address,
      idNumber, idCardFront, idCardBack, locationId,
      registerDate: new Date(),
      status: 'pending'
    });
    const saved = await customer.save();
    callback(null, { customerId: saved._id });
  } catch (err) {
    callback(err);
  }
};

export const getAllCustomers = async (page = 1, limit = 15, locationId, callback) => {
  try {
    const filter = locationId ? { locationId } : {};
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Customer.countDocuments(filter)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const getCustomerById = async (id, callback) => {
  try {
    const customer = await Customer.findById(id);
    if (!customer) return callback(null, null);
    callback(null, customer);
  } catch (err) {
    callback(err);
  }
};

export const updateCustomerById = async (id, data, callback) => {
  try {
    const customer = await Customer.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true });
    if (!customer) return callback({ message: 'Không tìm thấy khách hàng!' });
    callback(null, customer);
  } catch (err) {
    callback(err);
  }
};

export const deleteCustomerById = async (id, callback) => {
  try {
    const customer = await Customer.findByIdAndDelete(id);
    if (!customer) return callback({ message: 'Không tìm thấy khách hàng!' });
    callback(null, { success: true, idCardFront: customer.idCardFront, idCardBack: customer.idCardBack });
  } catch (err) {
    callback(err);
  }
};

export const approveCustomer = async (id, staffId, callback) => {
  try {
    const customer = await Customer.findByIdAndUpdate(id, {
      status: 'approved',
      approvedBy: staffId,
      approvedAt: new Date(),
      updatedAt: new Date()
    }, { new: true });
    if (!customer) return callback({ message: 'Không tìm thấy khách hàng!' });
    callback(null, customer);
  } catch (err) {
    callback(err);
  }
};

export const rejectCustomer = async (id, reason, callback) => {
  try {
    const customer = await Customer.findByIdAndUpdate(id, {
      status: 'rejected',
      rejectionReason: reason,
      updatedAt: new Date()
    }, { new: true });
    if (!customer) return callback({ message: 'Không tìm thấy khách hàng!' });
    callback(null, customer);
  } catch (err) {
    callback(err);
  }
};

export const findCustomerByAccount = async (account, callback) => {
  try {
    const customer = await Customer.findOne({ account });
    callback(null, customer);
  } catch (err) {
    callback(err);
  }
};

export const getPendingCustomers = async (callback) => {
  try {
    const customers = await Customer.find({ status: 'pending' }).sort({ createdAt: -1 });
    callback(null, customers);
  } catch (err) {
    callback(err);
  }
};