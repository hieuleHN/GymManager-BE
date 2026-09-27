import Customer from './schemas/customerSchema.js';
import Staff from './schemas/staffSchema.js';
import bcrypt from 'bcryptjs';

export const createCustomer = async (data, callback) => {
  try {
    const { account, password, locationId } = data;
    const existing = await Customer.findOne({ account });
    if (existing) return callback({ message: 'Tài khoản đã tồn tại!' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const customer = new Customer({
      account, password: hashedPassword, locationId,
      registerDate: new Date(),
      status: 'pending'
    });
    const saved = await customer.save();
    callback(null, { customerId: saved._id });
  } catch (err) {
    callback(err);
  }
};

export const getAllCustomers = async (page = 1, limit = 15, locationIdOrFilter, callback) => {
  try {
    // Tương thích ngược: tham số thứ 3 có thể là string locationId hoặc object filter { locationId, search, status }
    // (giống cách Staff làm search server-side để kết quả hiện ngay trang 1)
    let filter = {};
    if (typeof locationIdOrFilter === 'string') {
      if (locationIdOrFilter) filter.locationId = locationIdOrFilter;
    } else if (locationIdOrFilter && typeof locationIdOrFilter === 'object') {
      filter = { ...locationIdOrFilter };
      Object.keys(filter).forEach(k => {
        if (filter[k] === '' || filter[k] === undefined || filter[k] === 'all') delete filter[k];
      });
    }
    const mongoFilter = {};
    if (filter.locationId) mongoFilter.locationId = filter.locationId;
    if (filter.status) mongoFilter.status = filter.status;
    if (filter.search) {
      const esc = String(filter.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(esc, 'i');
      mongoFilter.$or = [
        { fullName: regex },
        { account: regex },
        { phone: regex }
      ];
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Customer.find(mongoFilter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Customer.countDocuments(mongoFilter)
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

export const submitPersonalInfo = async (id, data, files, callback) => {
  try {
    const updateData = {
      fullName: data.fullName,
      gender: data.gender,
      phone: data.phone,
      email: data.email,
      address: data.address || '',
      idNumber: data.idNumber || '',
      bio: data.bio || '',
      status: 'pending_approval',
      infoFilledAt: new Date(),
      updatedAt: new Date()
    };
    if (files?.idCardFront) updateData.idCardFront = files.idCardFront[0].filename;
    if (files?.idCardBack) updateData.idCardBack = files.idCardBack[0].filename;

    const customer = await Customer.findByIdAndUpdate(id, updateData, { new: true });
    if (!customer) return callback({ message: 'Không tìm thấy khách hàng!' });
    callback(null, customer);
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

export const lockCustomer = async (id, callback) => {
  try {
    const customer = await Customer.findByIdAndUpdate(id, {
      status: 'locked',
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

export const searchCustomers = async (query, callback, locationId, hidePhone = false, includeNoLocation = false) => {
  try {
    const q = String(query || '').trim();
    if (!q) return callback(null, []);
    // hidePhone: ẩn SĐT (trang hội viên) - chỉ tìm theo tài khoản / họ tên, không trả về SĐT
    const textOr = hidePhone
      ? [
        { account: { $regex: q, $options: 'i' } },
        { fullName: { $regex: q, $options: 'i' } }
      ]
      : [
        { account: { $regex: q, $options: 'i' } },
        { fullName: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } }
      ];
    const filter = { $or: textOr };
    if (locationId) {
      if (includeNoLocation) {
        // Kèm cả hội viên chưa set cơ sở (người mới/chưa có gói) - ưu tiên cùng CLB lên trước
        filter.$and = [{ $or: [{ locationId }, { locationId: null }, { locationId: { $exists: false } }] }];
      } else {
        filter.locationId = locationId;
      }
    }
    const customers = await Customer.find(filter)
      .select(hidePhone ? '_id account fullName avatar status locationId' : '_id account fullName avatar phone status locationId')
      .limit(includeNoLocation ? 20 : 8)
      .lean();
    if (includeNoLocation && locationId) {
      const lid = String(locationId);
      customers.sort((a, b) => {
        const aSame = String(a.locationId || '') === lid ? 0 : 1;
        const bSame = String(b.locationId || '') === lid ? 0 : 1;
        return aSame - bSame;
      });
    }
    callback(null, customers);
  } catch (err) {
    callback(err);
  }
};

export const getPendingCustomers = async (callback) => {
  try {
    const customers = await Customer.find({ status: { $in: ['pending', 'pending_approval'] } }).sort({ createdAt: -1 });
    callback(null, customers);
  } catch (err) {
    callback(err);
  }
};

export const getAllCustomerIds = async (callback) => {
  try {
    const customers = await Customer.find({ status: 'approved' }).select('_id');
    callback(null, customers.map(c => c._id));
  } catch (err) {
    callback(err);
  }
};

export const getCustomersByDeadline = async (callback) => {
  try {
    const now = new Date();
    const customers = await Customer.find({
      status: 'pending',
      infoFilledAt: { $exists: false }
    }).sort({ createdAt: -1 });
    callback(null, customers);
  } catch (err) {
    callback(err);
  }
};
