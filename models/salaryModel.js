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
      const baseSalary = existing?.baseSalary ?? s.baseSalary ?? 0;
      const bonus = existing?.bonus ?? s.bonus ?? 0;
      const attendanceBonus = existing?.attendanceBonus ?? s.attendanceBonus ?? 0;
      const latePenalty = existing?.latePenalty ?? s.latePenalty ?? 0;
      const commissionPackage = existing?.commissionPackage ?? s.commissionPackage ?? 0;
      const commissionPT = existing?.commissionPT ?? s.commissionPT ?? 0;
      const revenueShare = existing?.revenueShare ?? s.revenueShare ?? 0;
      return {
        _id: s._id,
        name: s.fullName,
        job: s.job?.name || 'Chưa xác định',
        jobId: s.job?._id,
        baseSalary,
        bonus,
        attendanceBonus,
        latePenalty,
        commissionPackage,
        commissionPT,
        revenueShare,
        totalSalary: baseSalary + bonus + attendanceBonus + commissionPackage + commissionPT + revenueShare - latePenalty,
        isPaid: existing?.isPaid ?? false,
        salaryId: existing?._id || null
      };
    });
    callback(null, { data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    callback(err);
  }
};

export const updateSalary = async (staffId, fields, callback) => {
  try {
    const updateData = {};
    const allowed = ['baseSalary', 'attendanceBonus', 'latePenalty', 'commissionPackage', 'commissionPT', 'revenueShare', 'bonus'];
    for (const key of allowed) {
      if (fields[key] !== undefined) updateData[key] = fields[key];
    }
    if (Object.keys(updateData).length === 0) return callback({ message: 'Không có dữ liệu cập nhật!' });

    const staff = await Staff.findByIdAndUpdate(staffId, updateData, { new: true });
    if (!staff) return callback({ message: 'Không tìm thấy nhân viên!' });

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const baseSalary = staff.baseSalary || 0;
    const bonus = staff.bonus || 0;
    const attendanceBonus = staff.attendanceBonus || 0;
    const latePenalty = staff.latePenalty || 0;
    const commissionPackage = staff.commissionPackage || 0;
    const commissionPT = staff.commissionPT || 0;
    const revenueShare = staff.revenueShare || 0;

    const totalSalary = baseSalary + bonus + attendanceBonus + commissionPackage + commissionPT + revenueShare - latePenalty;

    await Salary.findOneAndUpdate(
      { staffId, month, year },
      { baseSalary, bonus, attendanceBonus, latePenalty, commissionPackage, commissionPT, revenueShare, totalSalary },
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

    const baseSalary = staff.baseSalary || 0;
    const bonus = staff.bonus || 0;
    const attendanceBonus = staff.attendanceBonus || 0;
    const latePenalty = staff.latePenalty || 0;
    const commissionPackage = staff.commissionPackage || 0;
    const commissionPT = staff.commissionPT || 0;
    const revenueShare = staff.revenueShare || 0;
    const totalSalary = baseSalary + bonus + attendanceBonus + commissionPackage + commissionPT + revenueShare - latePenalty;

    const salary = await Salary.findOneAndUpdate(
      { staffId, month, year },
      {
        staffId, baseSalary, bonus, attendanceBonus, latePenalty,
        commissionPackage, commissionPT, revenueShare,
        totalSalary, month, year, isPaid: true, paidAt: now, paidBy
      },
      { upsert: true, new: true }
    );

    await SalaryHistory.create({
      staffId, baseSalary, bonus, attendanceBonus, latePenalty,
      commissionPackage, commissionPT, revenueShare,
      totalSalary, month, year, paidAt: now, paidBy
    });

    staff.bonus = 0;
    staff.attendanceBonus = 0;
    staff.latePenalty = 0;
    staff.commissionPackage = 0;
    staff.commissionPT = 0;
    staff.revenueShare = 0;
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