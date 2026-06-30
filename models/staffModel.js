import Staff from './schemas/staffSchema.js';
import bcrypt from 'bcryptjs';


export const getTrainers = async (callback) => {
  try {
    const trainers = await Staff.find({ status: 'active' })
      .populate('job', 'name description isAdmin')
      .populate('locationId', 'title address')
      .sort({ rating: -1 });
    const filtered = trainers.filter(t => t.job && !t.job.isAdmin);
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
      job: data.job,
      startDate: data.startDate || new Date(),
      address: data.address || '',
      baseSalary: data.baseSalary || 0,
      bonus: data.bonus || 0,
      locationId: data.locationId || null,
      status: 'active'
    });
    const saved = await staff.save();
    callback(null, { staffId: saved._id });
  } catch (err) {
    callback(err);
  }
};

export const getAllStaff = async (page = 1, limit = 15, locationId, callback) => {
  try {
    const filter = locationId ? { locationId } : {};
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Staff.find(filter).populate('job', 'name salary').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Staff.countDocuments(filter)
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const getStaffById = async (id, callback) => {
  try {
    const staff = await Staff.findById(id).populate('job', 'name salary');
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
    if (data.job) staff.job = data.job;
    if (data.startDate) staff.startDate = data.startDate;
    if (data.address !== undefined) staff.address = data.address;
    if (data.baseSalary !== undefined) staff.baseSalary = data.baseSalary;
    if (data.bonus !== undefined) staff.bonus = data.bonus;
    if (data.status) staff.status = data.status;

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
    const staff = await Staff.findOne({ account }).populate('job', 'name salary isAdmin');
    callback(null, staff);
  } catch (err) {
    callback(err);
  }
};