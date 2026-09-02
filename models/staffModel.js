import Staff from './schemas/staffSchema.js';
import bcrypt from 'bcryptjs';


export const getTrainers = async (permission, callback) => {
  try {
    if (typeof permission === 'function') { callback = permission; permission = null; }
    const trainers = await Staff.find({ status: 'active' })
      .populate('job', 'name description isAdmin permissions')
      .populate('locationId', 'title address')
      .populate('disciplineId', 'name')
      .sort({ rating: -1 });
    let filtered = trainers.filter(t =>
      t.job &&
      !t.job.isAdmin &&
      /huấn luyện viên|trainer|pt|hlv/i.test(t.job.name || '')
    );
    if (permission) {
      filtered = filtered.filter(t => t.job?.permissions?.includes(permission));
    }
    callback(null, filtered);
  } catch (error) {
    callback(error);
  }
};

export const createStaff = async (data, callback) => {
  try {
    const existing = await Staff.findOne({ $or: [{ account: data.account }, { email: data.email }] });
    if (existing) return callback({ message: 'Tài khoản hoặc email đã tồn tại!' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const staff = new Staff({
      account: data.account,
      password: hashedPassword,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      gender: data.gender || 'Nam',
      dateOfBirth: data.dateOfBirth || null,
      job: data.job,
      startDate: new Date(),
      address: data.address || '',
      locationId: data.locationId || null,
      status: data.status || 'active',
      avatar: data.avatar || ''
    });
    const saved = await staff.save();
    callback(null, { staffId: saved._id });
  } catch (err) {
    callback(err);
  }
};

export const getAllStaff = async (page = 1, limit = 10, filterOrLocationId, callback) => {
  try {
    let filter = {};
    if (typeof filterOrLocationId === 'string') {
      if (filterOrLocationId) filter.locationId = filterOrLocationId;
    } else if (filterOrLocationId && typeof filterOrLocationId === 'object') {
      filter = { ...filterOrLocationId };
      Object.keys(filter).forEach(k => {
        if (filter[k] === '' || filter[k] === undefined || filter[k] === 'all') delete filter[k];
      });
    }
    const mongoFilter = {};
    if (filter.locationId) mongoFilter.locationId = filter.locationId;
    if (filter.status) mongoFilter.status = filter.status;
    if (filter.job) mongoFilter.job = filter.job;
    if (filter.gender) mongoFilter.gender = filter.gender;
    if (filter.excludeJobIds && Array.isArray(filter.excludeJobIds) && filter.excludeJobIds.length) {
      // Loại bỏ các job bị cấm xem (admin/manager) – kết hợp với filter.job nếu có
      if (mongoFilter.job) {
        // đã có job cụ thể, nếu job đó nằm trong exclude thì đã return rỗng ở controller
        mongoFilter.job = { $in: [mongoFilter.job], $nin: filter.excludeJobIds };
      } else {
        mongoFilter.job = { $nin: filter.excludeJobIds };
      }
    }
    if (filter.search) {
      const esc = filter.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(esc, 'i');
      mongoFilter.$or = [
        { fullName: regex },
        { account: regex },
        { email: regex },
        { phone: regex }
      ];
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Staff.find(mongoFilter).populate('job', 'name').sort({ status: 1, createdAt: -1 }).skip(skip).limit(limit),
      Staff.countDocuments(mongoFilter)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const getStaffById = async (id, callback) => {
  try {
    const staff = await Staff.findById(id)
      .populate('job', 'name description')
      .populate('disciplineId', 'name')
      .populate('locationId', 'title address');
    if (!staff) return callback(null, null);
    callback(null, staff);
  } catch (err) {
    callback(err);
  }
};

export const updateStaffById = async (id, data, callback) => {
  try {
    const staff = await Staff.findById(id);
    if (!staff) return callback({ message: 'Không tìm thấy nhân viên!' });

    if (data.fullName) staff.fullName = data.fullName;
    if (data.email) staff.email = data.email;
    if (data.phone) staff.phone = data.phone;
    if (data.gender) staff.gender = data.gender;
    if (data.dateOfBirth !== undefined) staff.dateOfBirth = data.dateOfBirth || null;
    if (data.job) staff.job = data.job;
    if (data.address !== undefined) staff.address = data.address;
    if (data.status) staff.status = data.status;
    if (data.avatar !== undefined) staff.avatar = data.avatar;
    if (data.coverImage !== undefined) staff.coverImage = data.coverImage;
    if (data.description !== undefined) staff.description = data.description;
    if (data.specialties !== undefined) staff.specialties = data.specialties;
    if (data.gallery !== undefined) staff.gallery = data.gallery;
    if (data.experience !== undefined) staff.experience = data.experience;
    if (data.certifications !== undefined) staff.certifications = data.certifications;
    if (data.disciplineId !== undefined) staff.disciplineId = data.disciplineId;
    if (data.pricePerSession !== undefined) staff.pricePerSession = data.pricePerSession;
    if (data.commissionPT !== undefined) staff.commissionPT = data.commissionPT;

    const saved = await staff.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const deleteStaffById = async (id, callback) => {
  try {
    const staff = await Staff.findByIdAndDelete(id);
    if (!staff) return callback({ message: 'Không tìm thấy nhân viên!' });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};

export const findStaffByAccount = async (account, callback) => {
  try {
    const staff = await Staff.findOne({ account }).populate('job', 'name isAdmin permissions');
    callback(null, staff);
  } catch (err) {
    callback(err);
  }
};