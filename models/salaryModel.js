import Salary from './schemas/salarySchema.js';
import SalaryHistory from './schemas/salaryHistorySchema.js';
import Staff from './schemas/staffSchema.js';

export const getSalaryDetails = async (page = 1, limit = 15, callback) => {
  try {
    const skip = (page - 1) * limit;
    const [staff, total, salaries] = await Promise.all([
      Staff.find({ status: 'active' }).populate('job', 'name salary').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Staff.countDocuments({ status: 'active' }),
      Salary.find({ month: new Date().getMonth() + 1, year: new Date().getFullYear() })
    ]);

    const data = staff.map(s => {
      const existing = salaries.find(sal => sal.staffId.toString() === s._id.toString());
      return {
        _id: s._id,
        name: s.fullName,
        job: s.job?.name || 'Chưa xác định',
        jobId: s.job?._id,
        bonus: existing?.bonus ?? s.bonus ?? 0,
        baseSalary: existing?.baseSalary ?? s.baseSalary ?? 0,
        totalSalary: (existing?.baseSalary ?? s.baseSalary ?? 0) + (existing?.bonus ?? s.bonus ?? 0),
        isPaid: existing?.isPaid ?? false,
        salaryId: existing?._id || null
      };
    });
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const updateSalary = async (staffId, newBaseSalary, callback) => {
  try {
    const staff = await Staff.findByIdAndUpdate(staffId, { baseSalary: newBaseSalary }, { new: true });
    if (!staff) return callback({ message: 'Không tìm thấy nhân viên!' });
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    await Salary.findOneAndUpdate(
      { staffId, month, year },
      { baseSalary: newBaseSalary, totalSalary: newBaseSalary + staff.bonus },
      { upsert: true, new: true }
    );
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};

export const paySalary = async (staffId, paidBy, callback) => {
  try {
    const staff = await Staff.findById(staffId);
    if (!staff) return callback({ message: 'Không tìm thấy nhân viên!' });
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const totalSalary = staff.baseSalary + staff.bonus;

    const salary = await Salary.findOneAndUpdate(
      { staffId, month, year },
      {
        staffId, baseSalary: staff.baseSalary, bonus: staff.bonus,
        totalSalary, month, year, isPaid: true, paidAt: now, paidBy
      },
      { upsert: true, new: true }
    );

    await SalaryHistory.create({
      staffId, baseSalary: staff.baseSalary, bonus: staff.bonus,
      totalSalary, month, year, paidAt: now, paidBy
    });

    staff.bonus = 0;
    await staff.save();
    callback(null, salary);
  } catch (err) {
    callback(err);
  }
};

export const getSalaryHistory = async (page = 1, limit = 15, callback) => {
  try {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      SalaryHistory.find()
        .populate('staffId', 'fullName')
        .populate('paidBy', 'fullName')
        .sort({ paidAt: -1 }).skip(skip).limit(limit),
      SalaryHistory.countDocuments()
    ]);
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const getSalaryHistoryByStaff = async (staffId, callback) => {
  try {
    const history = await SalaryHistory.find({ staffId })
      .populate('paidBy', 'fullName')
      .sort({ paidAt: -1 });
    callback(null, history);
  } catch (err) {
    callback(err);
  }
};