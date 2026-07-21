import { generateStaffQRToken, verifyQRToken } from '../services/qrService.js';
import Staff from '../models/schemas/staffSchema.js';
import Job from '../models/schemas/jobSchema.js';
import StaffAttendance from '../models/schemas/staffAttendanceSchema.js';
import StaffShift from '../models/schemas/staffShiftSchema.js';

const SHIFT_TIMES = {
  'morning-noon':      { start: '06:00', end: '13:30' },
  'afternoon-evening': { start: '13:30', end: '21:00' },
};

const LATE_RATE_PER_MIN = 10000;
const ATTENDANCE_BONUS = 500000;

function parseTime(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function calcMinutesLate(checkInDate, shiftStartStr, graceMinutes = 15) {
  const ci = checkInDate.getHours() * 60 + checkInDate.getMinutes();
  const ss = parseTime(shiftStartStr) + graceMinutes;
  return ci > ss ? ci - ss : 0;
}

function calcMinutesEarly(checkOutDate, shiftEndStr) {
  const co = checkOutDate.getHours() * 60 + checkOutDate.getMinutes();
  const se = parseTime(shiftEndStr);
  return co < se ? se - co : 0;
}

function calcOvertime(checkInDate, checkOutDate, shiftEndStr) {
  const co = checkOutDate.getHours() * 60 + checkOutDate.getMinutes();
  const se = parseTime(shiftEndStr);
  return co > se ? co - se : 0;
}

export const generateQR = async (req, res) => {
  try {
    const staff = await Staff.findById(req.user.id);
    if (!staff) return res.status(404).json({ error: 'Không tìm thấy nhân viên!' });
    const token = generateStaffQRToken(staff._id);
    res.json({ token, expiredIn: 30 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const verifyQR = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Thiếu QR token!' });

    let decoded;
    try { decoded = verifyQRToken(token); }
    catch { return res.status(400).json({ error: 'QR đã hết hạn hoặc không hợp lệ!' }); }

    if (decoded.purpose !== 'staff-checkin')
      return res.status(400).json({ error: 'QR không hợp lệ!' });

    const staff = await Staff.findById(decoded.staffId).populate('job', 'name');
    if (!staff) return res.status(404).json({ error: 'Không tìm thấy nhân viên!' });

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const existing = await StaffAttendance.findOne({
      staffId: staff._id,
      date: { $gte: dayStart, $lte: dayEnd }
    });

    const shift = await StaffShift.findOne({
      staffId: staff._id,
      date: { $gte: dayStart, $lte: dayEnd }
    });

    let shiftInfo = null;
    if (shift && SHIFT_TIMES[shift.shift]) {
      shiftInfo = { type: shift.shift, start: SHIFT_TIMES[shift.shift].start, end: SHIFT_TIMES[shift.shift].end };
    }

    // Check-out flow
    if (existing) {
      if (!existing.checkOutTime) {
        existing.checkOutTime = now;
        existing.status = 'checked-out';
        await existing.save();

        let minutesEarly = 0;
        let overtime = 0;
        const checkInMinutesLate = existing.minutesLate || calcMinutesLate(new Date(existing.checkInTime), shiftInfo?.start || '06:00');
        if (shiftInfo) {
          minutesEarly = calcMinutesEarly(now, shiftInfo.end);
          overtime = calcOvertime(existing.checkInTime, now, shiftInfo.end);
        }

        // Tính thưởng/phạt real-time
        let todayPenalty = checkInMinutesLate * LATE_RATE_PER_MIN + minutesEarly * LATE_RATE_PER_MIN;
        let todayBonus = 0;

        if (checkInMinutesLate === 0 && minutesEarly === 0) {
          todayBonus = ATTENDANCE_BONUS;
        }

        if (todayPenalty > 0) {
          staff.latePenalty = (staff.latePenalty || 0) + todayPenalty;
        }
        if (todayBonus > 0) {
          staff.attendanceBonus = (staff.attendanceBonus || 0) + todayBonus;
        }
        await staff.save();

        return res.json({
          message: 'Check-out thành công!',
          staff: { id: staff._id, fullName: staff.fullName, job: staff.job?.name, phone: staff.phone },
          shift: shiftInfo,
          status: 'checked-out',
          checkInTime: existing.checkInTime,
          checkOutTime: now,
          minutesLate: checkInMinutesLate,
          minutesEarly,
          overtime,
          totalMinutes: Math.round((now - existing.checkInTime) / 60000),
          todayBonus,
          todayPenalty,
        });
      }
      return res.status(400).json({ error: 'Nhân viên đã check-out hôm nay!' });
    }

    // Check-in flow
    let status = 'checked-in';
    let minutesLate = 0;

    if (shiftInfo) {
      minutesLate = calcMinutesLate(now, shiftInfo.start);
      if (minutesLate > 0) status = 'late';
    }

    const attendance = await StaffAttendance.create({
      staffId: staff._id,
      shiftId: shift?._id || null,
      date: now,
      checkInTime: now,
      locationId: staff.locationId,
      status,
      minutesLate,
    });

    res.json({
      message: status === 'late' ? `Check-in thành công (đi muộn ${minutesLate} phút)!` : 'Check-in thành công!',
      staff: { id: staff._id, fullName: staff.fullName, job: staff.job?.name, phone: staff.phone },
      shift: shiftInfo,
      status,
      checkInTime: now,
      minutesLate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const todayAttendance = async (req, res) => {
  try {
    const q = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setHours(23, 59, 59, 999);
    q.date = { $gte: today, $lte: tomorrow };
    if (req.query.locationId) q.locationId = req.query.locationId;

    const records = await StaffAttendance.find(q)
      .populate('staffId', 'fullName account')
      .populate('shiftId', 'shift')
      .sort({ checkInTime: -1 });

    const enriched = records.map(r => {
      const item = r.toObject();
      if (item.shiftId?.shift && SHIFT_TIMES[item.shiftId.shift]) {
        const s = SHIFT_TIMES[item.shiftId.shift];
        item.shiftTimes = s;
        if (item.checkInTime) item.minutesLate = calcMinutesLate(new Date(item.checkInTime), s.start);
        if (item.checkOutTime && item.checkInTime) {
          item.minutesEarly = calcMinutesEarly(new Date(item.checkOutTime), s.end);
          item.overtime = calcOvertime(new Date(item.checkInTime), new Date(item.checkOutTime), s.end);
          item.totalMinutes = Math.round((new Date(item.checkOutTime) - new Date(item.checkInTime)) / 60000);
        }
      }
      return item;
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const attendanceHistory = async (req, res) => {
  try {
    const { staffId, page, limit } = req.query;
    const q = staffId ? { staffId } : {};
    const total = await StaffAttendance.countDocuments(q);
    const data = await StaffAttendance.find(q)
      .populate('staffId', 'fullName account')
      .sort({ date: -1 })
      .skip(((Number(page) || 1) - 1) * (Number(limit) || 20))
      .limit(Number(limit) || 20);
    res.json({ data, total, page: Number(page) || 1, totalPages: Math.ceil(total / (Number(limit) || 20)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
