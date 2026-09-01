import {
  createStaff, getAllStaff, getStaffById, updateStaffById, deleteStaffById, findStaffByAccount, getTrainers
} from '../models/staffModel.js';
import { findCustomerByAccount } from '../models/customerModel.js';
import { getJobById } from '../models/jobModel.js';
import { getPermissionsByJob } from '../models/permissionModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Staff from '../models/schemas/staffSchema.js';
import StaffAttendance from '../models/schemas/staffAttendanceSchema.js';
import StaffShift from '../models/schemas/staffShiftSchema.js';
import Location from '../models/schemas/locationSchema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';

export const listTrainers = (req, res) => {
  const { disciplineId, locationId, permission } = req.query;
  getTrainers(permission, (err, trainers) => {
      if (err) return res.status(500).json({ error: 'Lỗi lấy danh sách: ' + err.message });
      let filtered = trainers;
      if (disciplineId) {
        filtered = filtered.filter(t =>
          t.disciplineId?._id?.toString() === disciplineId ||
          t.specialties?.some(s => s.toLowerCase().includes(
            trainers.find(t2 => t2.disciplineId?._id?.toString() === disciplineId)?.disciplineId?.name?.toLowerCase() || ''
          ))
        );
      }
      if (locationId) {
        filtered = filtered.filter(t => t.locationId?._id?.toString() === locationId);
      }
      res.json(filtered);
  })
}

export const login = (req, res) => {
  const { account, password } = req.body;
  if (!account || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tài khoản và mật khẩu!' });
  }
  findStaffByAccount(account, (err, staff) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!staff) return res.status(400).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });
    bcrypt.compare(password, staff.password, (err, isMatch) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!isMatch) return res.status(400).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });

      const jobId = staff.job?._id;
      const isAdmin = staff.job?.isAdmin === true;
      const jobPermissions = staff.job?.permissions || [];

      getPermissionsByJob(jobId, (err, permission) => {
        let permissions = [];
        if (permission && permission.permissions) {
          permissions = permission.permissions
            .filter(p => p.actions && p.actions.length > 0)
            .map(p => p.feature);
        }

        const token = jwt.sign(
          { id: staff._id, role: staff.job?.name || 'staff', username: staff.account, fullName: staff.fullName, isStaff: true, jobId, isAdmin },
          JWT_SECRET,
          { expiresIn: '3d' }
        );
        res.json({
          message: 'Đăng nhập thành công!',
          token,
          user: {
            id: staff._id,
            username: staff.account,
            fullName: staff.fullName,
            role: staff.job?.name || 'staff',
            jobId,
            isStaff: true,
            isAdmin,
            locationId: staff.locationId || null,
            permissions,
            jobPermissions
          }
        });
      });
    });
  });
};

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const { locationId, search, status, job, gender } = req.query;
  const filter = { locationId, search, status, job, gender };
  getAllStaff(page, limit, filter, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy danh sách: ' + err.message });
    res.json(result);
  });
};

export const detail = (req, res) => {
  getStaffById(req.params.id, (err, staff) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!staff) return res.status(404).json({ error: 'Không tìm thấy nhân viên!' });
    res.json(staff);
  });
};

export const create = (req, res) => {
  const { account, password, fullName, email, phone, gender, dateOfBirth, job, address, locationId, status, avatar } = req.body;
  if (!account || !password || !fullName || !email || !phone || !job) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin bắt buộc!' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự!' });
  }
  const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ!' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email không hợp lệ!' });
  }
  findStaffByAccount(account, (err, existingStaff) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existingStaff) return res.status(400).json({ error: 'Tên tài khoản đã tồn tại trong hệ thống!' });

    findCustomerByAccount(account, (err, existingCustomer) => {
      if (err) return res.status(500).json({ error: err.message });
      if (existingCustomer) return res.status(400).json({ error: 'Tên tài khoản đã tồn tại trong hệ thống!' });

      const staffData = { account, password, fullName, email, phone, gender, dateOfBirth, job, address, locationId, status, avatar };
      createStaff(staffData, (err, result) => {
        if (err) return res.status(400).json({ error: err.message || 'Lỗi thêm nhân viên!' });
        res.status(201).json({ message: 'Thêm nhân viên thành công!', staffId: result.staffId });
      });
    });
  });
};

export const update = (req, res) => {
  const { fullName, email, phone, gender, dateOfBirth, job, address, status, avatar, coverImage, description, specialties, gallery, experience, certifications, disciplineId, pricePerSession } = req.body;
  const data = { fullName, email, phone, gender, dateOfBirth, job, address, status, avatar, coverImage, description, specialties, gallery, experience, certifications, disciplineId, pricePerSession };
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
  updateStaffById(req.params.id, data, (err, staff) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi cập nhật!' });
    res.json({ message: 'Cập nhật nhân viên thành công!', staff });
  });
};

export const remove = (req, res) => {
  deleteStaffById(req.params.id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Xóa nhân viên thành công!' });
  });
};

// FaceID cho nhân viên
export const registerFace = async (req, res) => {
  try {
    const { id } = req.params;
    const { faceDescriptor } = req.body;
    if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
      return res.status(400).json({ error: 'Thiếu faceDescriptor' });
    }
    const staff = await Staff.findById(id);
    if (!staff) return res.status(404).json({ error: 'Không tìm thấy nhân viên!' });
    staff.faceDescriptor = faceDescriptor;
    await staff.save();
    res.json({ message: 'Đăng ký FaceID nhân viên thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lỗi đăng ký FaceID' });
  }
};

export const removeFace = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await Staff.findById(id);
    if (!staff) return res.status(404).json({ error: 'Không tìm thấy nhân viên!' });
    staff.faceDescriptor = [];
    await staff.save();
    res.json({ message: 'Đã xóa FaceID của nhân viên' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lỗi xóa FaceID' });
  }
};

export const faceDescriptors = async (req, res) => {
  try {
    const staffs = await Staff.find({ faceDescriptor: { $exists: true, $not: { $size: 0 } } }).select('_id fullName faceDescriptor');
    res.json({ success: true, data: staffs.map(s => ({ _id: s._id, faceDescriptor: s.faceDescriptor })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const SHIFT_TIMES = {
  'morning-noon': { start: '06:00', end: '13:30' },
  'afternoon-evening': { start: '13:30', end: '21:00' },
};
const LATE_RATE_PER_MIN = 10000;
const ATTENDANCE_BONUS = 500000;
function parseTime(str) { const [h,m]=str.split(':').map(Number); return h*60+m; }
function calcMinutesLate(checkInDate, shiftStartStr, graceMinutes=15){ const ci=checkInDate.getHours()*60+checkInDate.getMinutes(); const ss=parseTime(shiftStartStr)+graceMinutes; return ci>ss?ci-ss:0; }
function calcMinutesEarly(checkOutDate, shiftEndStr){ const co=checkOutDate.getHours()*60+checkOutDate.getMinutes(); const se=parseTime(shiftEndStr); return co<se?se-co:0; }
function calcOvertime(checkInDate, checkOutDate, shiftEndStr){ const co=checkOutDate.getHours()*60+checkOutDate.getMinutes(); const se=parseTime(shiftEndStr); return co>se?co-se:0; }
const getStationLocationId = (req) => {
  const u = req.user;
  const headerLoc = req.headers && req.headers['x-location-id'];
  if (u && u.isAdmin && headerLoc && headerLoc !== 'all' && headerLoc !== 'undefined') return headerLoc;
  return (u && u.isStaff && u.locationId) ? u.locationId : null;
};

export const verifyFaceAttendance = async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) return res.status(400).json({ error: 'Thiếu staffId' });
    const staff = await Staff.findById(staffId).populate('job','name');
    if (!staff) return res.status(404).json({ error: 'Không tìm thấy nhân viên!' });
    if (staff.faceDescriptor === undefined || staff.faceDescriptor.length === 0) {
      return res.status(400).json({ error: 'Nhân viên chưa đăng ký FaceID (FaceID trống)' });
    }
    const stationLocationId = getStationLocationId(req);
    if (stationLocationId && staff.locationId && String(staff.locationId) !== String(stationLocationId)) {
      const loc = await Location.findById(staff.locationId);
      const clubName = loc ? (loc.title || loc.address || 'chưa rõ') : 'khác';
      return res.status(403).json({ error: `Nhân viên này ở phòng tập ${clubName}` });
    }
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59);
    const existing = await StaffAttendance.findOne({ staffId: staff._id, date: { $gte: dayStart, $lte: dayEnd }, checkOutTime: null }).sort({ checkInTime: -1 });
    const shift = await StaffAttendance.findOne ? await StaffShift.findOne({ staffId: staff._id, date: { $gte: dayStart, $lte: dayEnd } }) : null;
    let shiftInfo = null;
    if (shift && SHIFT_TIMES[shift.shift]) shiftInfo = { type: shift.shift, start: SHIFT_TIMES[shift.shift].start, end: SHIFT_TIMES[shift.shift].end };
    if (existing) {
      existing.checkOutTime = now;
      existing.status = 'checked-out';
      await existing.save();
      let minutesEarly = 0; let overtime = 0;
      const checkInMinutesLate = existing.minutesLate || calcMinutesLate(new Date(existing.checkInTime), shiftInfo?.start || '06:00');
      if (shiftInfo) { minutesEarly = calcMinutesEarly(now, shiftInfo.end); overtime = calcOvertime(existing.checkInTime, now, shiftInfo.end); }
      let todayPenalty = checkInMinutesLate * LATE_RATE_PER_MIN + minutesEarly * LATE_RATE_PER_MIN;
      let todayBonus = 0;
      if (checkInMinutesLate === 0 && minutesEarly === 0) todayBonus = ATTENDANCE_BONUS;
      if (todayPenalty > 0) staff.latePenalty = (staff.latePenalty || 0) + todayPenalty;
      if (todayBonus > 0) staff.attendanceBonus = (staff.attendanceBonus || 0) + todayBonus;
      await staff.save();
      return res.json({ message: 'Check-out thành công!', staff: { id: staff._id, fullName: staff.fullName, job: staff.job?.name }, shift: shiftInfo, status: 'checked-out', checkInTime: existing.checkInTime, checkOutTime: now, minutesLate: checkInMinutesLate, minutesEarly, overtime, totalMinutes: Math.round((now - existing.checkInTime)/60000), todayBonus, todayPenalty });
    }
    let status = 'checked-in';
    let minutesLate = 0;
    if (shiftInfo) { minutesLate = calcMinutesLate(now, shiftInfo.start); if (minutesLate > 0) status = 'late'; }
    const attendance = await StaffAttendance.create({ staffId: staff._id, shiftId: shift?._id || null, date: now, checkInTime: now, locationId: staff.locationId, status, minutesLate });
    res.json({ message: 'Check-in thành công!', staff: { id: staff._id, fullName: staff.fullName, job: staff.job?.name }, shift: shiftInfo, status, checkInTime: now, minutesLate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
