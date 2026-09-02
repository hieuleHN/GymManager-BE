import { generateStaffQRToken, verifyQRToken } from '../services/qrService.js';
import Staff from '../models/schemas/staffSchema.js';
import Job from '../models/schemas/jobSchema.js';
import StaffAttendance from '../models/schemas/staffAttendanceSchema.js';
import StaffShift from '../models/schemas/staffShiftSchema.js';
import Location from '../models/schemas/locationSchema.js';
import Booking from '../models/schemas/bookingSchema.js';
import { LockerV2 } from '../models/lockerManagementModel.js';

// Lấy ID phòng tập của máy quét từ tài khoản nhân viên đang đăng nhập (locationId trong token).
// Admin / tài khoản không gắn phòng tập -> null (quản lý toàn bộ).
// Tài khoản admin (isAdmin) có thể chọn phòng tập cần quản lý qua header X-Location-Id.
const getStationLocationId = (req) => {
    const u = req.user;
    const headerLoc = req.headers && req.headers['x-location-id'];
    if (u && u.isAdmin && headerLoc && headerLoc !== 'all' && headerLoc !== 'undefined') {
        return headerLoc;
    }
    return (u && u.isStaff && u.locationId) ? u.locationId : null;
};

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

    // Kiểm tra phòng tập: nhân viên phải thuộc đúng phòng tập của máy quét
    const stationLocationId = getStationLocationId(req);
    if (stationLocationId && staff.locationId && String(staff.locationId) !== String(stationLocationId)) {
        const loc = await Location.findById(staff.locationId);
        const clubName = loc ? (loc.title || loc.address || 'chưa rõ') : 'khác';
        return res.status(403).json({ error: `Nhân viên này ở phòng tập ${clubName}` });
    }

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Ca đang mở trong ngày (chưa checkout) — nếu có thì lần quét này là CHECK-OUT
    const existing = await StaffAttendance.findOne({
      staffId: staff._id,
      date: { $gte: dayStart, $lte: dayEnd },
      checkOutTime: null
    }).sort({ checkInTime: -1 });

    const shiftsToday = await StaffShift.find({
      staffId: staff._id,
      date: { $gte: dayStart, $lte: dayEnd }
    });
    const shiftTypes = shiftsToday.map(s => s.shift);
    let shiftLabel = null;
    if (shiftTypes.includes('morning-noon') && shiftTypes.includes('afternoon-evening')) shiftLabel = 'Cả ngày';
    else if (shiftTypes.includes('morning-noon')) shiftLabel = 'Sáng';
    else if (shiftTypes.includes('afternoon-evening')) shiftLabel = 'Chiều';
    const primaryShift = shiftsToday[0] || null;
    let shiftInfo = null;
    if (primaryShift && SHIFT_TIMES[primaryShift.shift]) {
      shiftInfo = { type: primaryShift.shift, start: SHIFT_TIMES[primaryShift.shift].start, end: SHIFT_TIMES[primaryShift.shift].end };
    }
    // Lịch tập với hội viên hôm nay
    const todayBookings = await Booking.find({ trainerId: staff._id, date: { $gte: dayStart, $lte: dayEnd } }).populate('customerId', 'fullName').lean();
    const hasTrainingToday = todayBookings.length > 0;
    const trainingCount = todayBookings.length;
    const trainingSummary = todayBookings.slice(0, 3).map(b => ({ customerName: b.customerId?.fullName || 'Hội viên', time: b.startTime || b.time || '', status: b.status }));
    const staffDetail = { id: staff._id, fullName: staff.fullName, job: staff.job?.name, phone: staff.phone || '', avatar: staff.avatar || '', locationId: staff.locationId || null };

    // Check-out flow - chặn checkout quá nhanh 10s
    if (existing) {
      const elapsedMs = now.getTime() - new Date(existing.checkInTime).getTime();
      const CHECKOUT_COOLDOWN_MS = 10000;
      if (elapsedMs < CHECKOUT_COOLDOWN_MS) {
        const remain = Math.ceil((CHECKOUT_COOLDOWN_MS - elapsedMs) / 1000);
        return res.status(429).json({ error: `Vừa chấm công vào lúc ${new Date(existing.checkInTime).toLocaleTimeString('vi-VN')}. Vui lòng đợi ${remain}s nữa mới được chấm công ra.` });
      }
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
        type: 'staff',
        staff: staffDetail,
        shift: shiftInfo,
        shiftLabel,
        shiftsToday: shiftTypes,
        hasTrainingToday,
        trainingCount,
        trainingSummary,
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

    // Check-in flow
    let status = 'checked-in';
    let minutesLate = 0;

    if (shiftInfo) {
      minutesLate = calcMinutesLate(now, shiftInfo.start);
      if (minutesLate > 0) status = 'late';
    }

    await StaffAttendance.create({
      staffId: staff._id,
      shiftId: primaryShift?._id || null,
      date: now,
      checkInTime: now,
      locationId: staff.locationId,
      status,
      minutesLate,
    });

    res.json({
      message: 'Check-in thành công!',
      type: 'staff',
      staff: staffDetail,
      shift: shiftInfo,
      shiftLabel,
      shiftsToday: shiftTypes,
      hasTrainingToday,
      trainingCount,
      trainingSummary,
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
    // Nhân viên có phòng tập -> mặc định lọc đúng phòng tập của mình (có thể ghi đè bằng query)
    const loc = getStationLocationId(req);
    if (loc) q.locationId = loc;
    else if (req.query.locationId) q.locationId = req.query.locationId;

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
    // Nhân viên có phòng tập chỉ xem lịch sử chấm công của đúng phòng tập mình
    const loc = getStationLocationId(req) || req.query.locationId || null;
    if (loc) q.locationId = loc;

    // Lọc theo ngày (date) hoặc khoảng ngày (from/to)
    if (req.query.date) {
      const parts = String(req.query.date).split('-').map(Number);
      if (parts.length === 3 && parts.every(n => !isNaN(n))) {
        const [y, m, d] = parts;
        q.date = {
          $gte: new Date(y, m - 1, d, 0, 0, 0, 0),
          $lte: new Date(y, m - 1, d, 23, 59, 59, 999)
        };
      }
    } else if (req.query.from || req.query.to) {
      q.date = {};
      if (req.query.from) {
        const f = new Date(String(req.query.from).split('T')[0]);
        f.setHours(0, 0, 0, 0);
        q.date.$gte = f;
      }
      if (req.query.to) {
        const t = new Date(String(req.query.to).split('T')[0]);
        t.setHours(23, 59, 59, 999);
        q.date.$lte = t;
      }
    }

    const p = Number(page) || 1;
    const lim = Math.min(Number(limit) || 20, 200);
    const total = await StaffAttendance.countDocuments(q);
    const data = await StaffAttendance.find(q)
      .populate({
        path: 'staffId',
        select: 'fullName account phone avatar gender email job locationId',
        populate: { path: 'job', select: 'name' }
      })
      .populate('shiftId', 'shift notes')
      .sort({ date: -1, checkInTime: -1 })
      .skip((p - 1) * lim)
      .limit(lim);

    const enriched = data.map(r => {
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
      } else if (item.checkInTime && item.checkOutTime) {
        item.totalMinutes = Math.round((new Date(item.checkOutTime) - new Date(item.checkInTime)) / 60000);
      }
      item.statusLabel = {
        'checked-in': 'Đang làm',
        'checked-out': 'Đã chấm công',
        'absent': 'Nghỉ',
        'late': 'Đi muộn'
      }[item.status] || item.status;
      return item;
    });

    res.json({ data: enriched, total, page: p, limit: lim, totalPages: Math.ceil(total / lim) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Thống kê chấm công theo kỳ (week/month/quarter/year) hoặc khoảng ngày tùy chỉnh
export const attendanceStats = async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const loc = getStationLocationId(req) || req.query.locationId || null;

    let from = req.query.startDate ? new Date(String(req.query.startDate).split('T')[0]) : null;
    let to = req.query.endDate ? new Date(String(req.query.endDate).split('T')[0]) : null;

    if (!from && !to) {
      const now = new Date();
      to = now;
      from = new Date(now);
      if (period === 'week') { from.setDate(now.getDate() - 6); }
      else if (period === 'quarter') { from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); }
      else if (period === 'year') { from = new Date(now.getFullYear(), 0, 1); }
      else { from = new Date(now.getFullYear(), now.getMonth(), 1); }
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const match = { date: { $gte: from, $lte: to } };
    if (loc) match.locationId = loc;

    const records = await StaffAttendance.find(match)
      .populate('staffId', 'fullName account')
      .populate('shiftId', 'shift');

    const dailyMap = {};
    let total = 0, totalMinutes = 0, lateCount = 0, onTimeCount = 0, overtimeMinutes = 0;
    const shiftDist = { 'morning-noon': 0, 'afternoon-evening': 0, none: 0 };

    records.forEach(r => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dailyMap[key]) dailyMap[key] = { date: key, count: 0, totalMinutes: 0, lateCount: 0, overtimeMinutes: 0 };

      dailyMap[key].count++;
      total++;

      let minutes = r.totalMinutes || 0;
      if (r.checkInTime && r.checkOutTime) {
        minutes = Math.round((new Date(r.checkOutTime) - new Date(r.checkInTime)) / 60000);
      }
      dailyMap[key].totalMinutes += minutes;
      totalMinutes += minutes;

      const isLate = r.status === 'late' || (r.minutesLate || 0) > 0;
      if (isLate) { dailyMap[key].lateCount++; lateCount++; }
      if (r.status === 'checked-out' && !isLate && !(r.minutesEarly || 0)) onTimeCount++;

      if (r.overtime) { dailyMap[key].overtimeMinutes += r.overtime; overtimeMinutes += r.overtime; }

      const shiftKey = r.shiftId?.shift;
      if (shiftDist[shiftKey] !== undefined) shiftDist[shiftKey]++;
      else shiftDist.none++;
    });

    // Điền đầy đủ ngày trống trong khoảng (tránh biểu đồ mất ngày)
    const daily = [];
    for (let cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      daily.push(dailyMap[key] || { date: key, count: 0, totalMinutes: 0, lateCount: 0, overtimeMinutes: 0 });
    }

    // Đếm vắng mặt: ca được phân nhưng không có lượt chấm công trong ngày
    const shiftFilter = { date: { $gte: from, $lte: to } };
    if (loc) {
      // Ca không gắn phòng tập (phân khi chọn "Tất cả cơ sở") cũng phải tính vào
      shiftFilter.$or = [
        { locationId: loc },
        { locationId: null },
        { locationId: { $exists: false } },
      ];
    }
    const shifts = await StaffShift.find(shiftFilter);
    const attendedKeys = new Set(records.map(r => `${r.staffId?._id}|${new Date(r.date).toDateString()}`));
    const absentCount = shifts.filter(s =>
      s.staffId && !attendedKeys.has(`${s.staffId}|${new Date(s.date).toDateString()}`)
    ).length;

    const shiftDistData = [
      { name: 'Ca sáng', value: shiftDist['morning-noon'] },
      { name: 'Ca chiều', value: shiftDist['afternoon-evening'] },
      { name: 'Không phân ca', value: shiftDist.none },
    ].filter(s => s.value > 0);

    // Phân chia theo cơ sở phòng tập
    const byLocation = [];
    const locAgg = {};
    records.forEach(r => {
      const key = r.locationId ? String(r.locationId) : 'none';
      if (!locAgg[key]) locAgg[key] = { total: 0, totalMinutes: 0, lateCount: 0, onTimeCount: 0, absentCount: 0 };
      const g = locAgg[key];
      g.total++;
      let minutes = r.totalMinutes || 0;
      if (r.checkInTime && r.checkOutTime) {
        minutes = Math.round((new Date(r.checkOutTime) - new Date(r.checkInTime)) / 60000);
      }
      g.totalMinutes += minutes;
      const isLate = r.status === 'late' || (r.minutesLate || 0) > 0;
      if (isLate) g.lateCount++;
      if (r.status === 'checked-out' && !isLate && !(r.minutesEarly || 0)) g.onTimeCount++;
    });
    shifts.forEach(s => {
      const key = s.locationId ? String(s.locationId) : 'none';
      if (!locAgg[key]) locAgg[key] = { total: 0, totalMinutes: 0, lateCount: 0, onTimeCount: 0, absentCount: 0 };
      const attended = s.staffId && attendedKeys.has(`${s.staffId}|${new Date(s.date).toDateString()}`);
      if (!attended) locAgg[key].absentCount++;
    });
    if (Object.keys(locAgg).length > 0) {
      const locIds = Object.keys(locAgg).filter(k => k !== 'none');
      const locNameMap = {};
      if (locIds.length) {
        const locations = await Location.find({ _id: { $in: locIds } });
        locations.forEach(l => { locNameMap[String(l._id)] = l.title || l.address || 'Phòng tập'; });
      }
      Object.entries(locAgg).forEach(([key, g]) => {
        byLocation.push({
          locationId: key === 'none' ? null : key,
          locationName: key === 'none' ? 'Không gắn cơ sở' : (locNameMap[key] || 'Phòng tập'),
          ...g,
        });
      });
      byLocation.sort((a, b) => b.total - a.total);
    }

    res.json({
      summary: { total, totalMinutes, lateCount, onTimeCount, overtimeMinutes, absentCount },
      daily,
      shiftDist: shiftDistData,
      byLocation,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cảnh báo vắng mặt: nhân viên được phân ca nhưng không chấm công trong ngày
export const attendanceAbsences = async (req, res) => {
  try {
    const { from, to } = req.query;
    const loc = getStationLocationId(req) || req.query.locationId || null;
    if (!from || !to) return res.status(400).json({ error: 'Vui lòng chọn khoảng ngày!' });

    const start = new Date(String(from).split('T')[0]); start.setHours(0, 0, 0, 0);
    const end = new Date(String(to).split('T')[0]); end.setHours(23, 59, 59, 999);

    const shiftFilter = { date: { $gte: start, $lte: end } };
    if (loc) {
      // Ca không gắn phòng tập (phân khi chọn "Tất cả cơ sở") cũng phải tính vào
      shiftFilter.$or = [
        { locationId: loc },
        { locationId: null },
        { locationId: { $exists: false } },
      ];
    }

    const shifts = await StaffShift.find(shiftFilter)
      .populate('staffId', 'fullName account avatar phone gender email locationId');

    const staffIds = [...new Set(shifts.map(s => s.staffId?._id).filter(Boolean))];
    const attFilter = { date: { $gte: start, $lte: end } };
    if (staffIds.length) attFilter.staffId = { $in: staffIds };

    const attendances = await StaffAttendance.find(attFilter).select('staffId date');
    const attended = new Set(attendances.map(a => `${a.staffId}|${new Date(a.date).toDateString()}`));

    const absentList = shifts
      .filter(s => s.staffId && !attended.has(`${s.staffId._id}|${new Date(s.date).toDateString()}`))
      .map(s => {
        const st = s.staffId;
        return {
          _id: s._id,
          staff: { _id: st._id, fullName: st.fullName, account: st.account, avatar: st.avatar, phone: st.phone, gender: st.gender, email: st.email, locationId: st.locationId },
          date: s.date,
          shift: s.shift,
          shiftTimes: SHIFT_TIMES[s.shift] || null,
          notes: s.notes,
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ data: absentList, total: absentList.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const exportDailyDetail = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0,10);
    const [y,m,d] = dateStr.split('-').map(Number);
    const start = new Date(y, m-1, d, 0,0,0);
    const end = new Date(y, m-1, d, 23,59,59,999);
    const loc = getStationLocationId(req) || req.query.locationId || null;
    const attMatch = { date: { $gte: start, $lte: end } };
    if (loc) attMatch.locationId = loc;

    const records = await StaffAttendance.find(attMatch)
      .populate({ path: 'staffId', select: 'fullName account phone email gender job locationId status avatar pricePerSession commissionPT', populate: { path: 'job', select: 'name permissions' } })
      .populate('shiftId', 'shift')
      .sort({ checkInTime: 1 })
      .lean();
    if (!records.length) return res.status(404).json({ message: "Không có nhân viên nào chấm công trong ngày này!" });

    const grouped = new Map();
    for (const r of records) {
      const sid = String(r.staffId?._id || r.staffId);
      if (!grouped.has(sid)) grouped.set(sid, { staff: r.staffId, records: [] });
      grouped.get(sid).records.push(r);
    }
    const staffIds = [...grouped.keys()];
    const shifts = await StaffShift.find({ staffId: { $in: staffIds }, date: { $gte: start, $lte: end } }).lean();
    const shiftMap = new Map();
    for (const s of shifts) {
      const sid = String(s.staffId);
      if (!shiftMap.has(sid)) shiftMap.set(sid, []);
      shiftMap.get(sid).push(s.shift);
    }
    const allLockers = await LockerV2.find({ assignedType: 'STAFF' }).lean();
    const lockerMap = new Map();
    for (const l of allLockers) {
      if (l.assignedName) lockerMap.set(l.assignedName, l.lockerNumber);
      if (l.assignedPhone) lockerMap.set(l.assignedPhone, l.lockerNumber);
    }
    const bookings = await Booking.find({ trainerId: { $in: staffIds }, date: { $gte: start, $lte: end } }).populate('customerId', 'fullName').lean();
    const bookingMap = new Map();
    for (const b of bookings) {
      const sid = String(b.trainerId);
      if (!bookingMap.has(sid)) bookingMap.set(sid, []);
      bookingMap.get(sid).push(b);
    }

    const excelJS = (await import('exceljs')).default;
    const workbook = new excelJS.Workbook();
    const ws = workbook.addWorksheet(`NhanVien_${dateStr}`);
    ws.columns = [
      { header: "STT", key: "stt", width: 6 },
      { header: "Họ và tên", key: "fullName", width: 20 },
      { header: "Tài khoản", key: "account", width: 16 },
      { header: "SĐT", key: "phone", width: 14 },
      { header: "Email", key: "email", width: 22 },
      { header: "Giới tính", key: "gender", width: 10 },
      { header: "Công việc", key: "job", width: 18 },
      { header: "Trạng thái", key: "status", width: 12 },
      { header: "Ca hôm nay", key: "shift", width: 14 },
      { header: "Số lần chấm công", key: "count", width: 14 },
      { header: "Check-in (các lần)", key: "checkIns", width: 28 },
      { header: "Check-out (các lần)", key: "checkOuts", width: 28 },
      { header: "Tổng giờ làm", key: "totalHours", width: 14 },
      { header: "Đi muộn (phút)", key: "late", width: 12 },
      { header: "Về sớm (phút)", key: "early", width: 12 },
      { header: "Tăng ca (phút)", key: "overtime", width: 12 },
      { header: "Tủ đồ", key: "locker", width: 14 },
      { header: "Số lịch dạy", key: "trainingCount", width: 12 },
      { header: "Chi tiết lịch dạy", key: "trainingDetail", width: 40 },
      { header: "Phí/buổi (VNĐ)", key: "pricePerSession", width: 16 },
      { header: "Hoa hồng (%)", key: "commissionRate", width: 12 },
      { header: "Hoa hồng hôm nay (VNĐ)", key: "commissionToday", width: 18 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    ws.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getRow(1).height = 22;

    let idx = 1;
    for (const [sid, g] of grouped) {
      const st = g.staff || {};
      const recs = g.records;
      const shiftTypes = shiftMap.get(sid) || [];
      let shiftLabel = 'Không có ca';
      if (shiftTypes.includes('morning-noon') && shiftTypes.includes('afternoon-evening')) shiftLabel = 'Cả ngày';
      else if (shiftTypes.includes('morning-noon')) shiftLabel = 'Sáng';
      else if (shiftTypes.includes('afternoon-evening')) shiftLabel = 'Chiều';
      const checkIns = recs.map(r => r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('vi-VN') : '-').join(', ');
      const checkOuts = recs.map(r => r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('vi-VN') : 'Chưa ra').join(', ');
      const totalMinutes = recs.reduce((sum, r) => sum + (r.totalMinutes || (r.checkInTime && r.checkOutTime ? Math.round((new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime())/60000) : 0)), 0);
      const totalHours = totalMinutes ? `${Math.floor(totalMinutes/60)}h${totalMinutes%60}p` : '-';
      const late = recs.reduce((sum, r) => sum + (r.minutesLate || 0), 0);
      const early = recs.reduce((sum, r) => sum + (r.minutesEarly || 0), 0);
      const overtime = recs.reduce((sum, r) => sum + (r.overtime || 0), 0);
      const locker = lockerMap.get(st.fullName) || lockerMap.get(st.phone) || '-';
      const trainings = bookingMap.get(sid) || [];
      const trainingDetail = trainings.length ? trainings.map(t => `${t.customerId?.fullName || 'HV'} ${t.startTime||t.time||''} (${t.status})`).join('; ') : 'Không có lịch';
      const isTrainer = (() => {
        const j = st.job;
        if (!j) return false;
        const perms = j.permissions || [];
        const nameNorm = (j.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return perms.includes('huan_luyen_vien') || nameNorm.includes('huan luyen vien') || nameNorm.includes('hlv') || nameNorm.includes('trainer') || nameNorm.includes('pt');
      })();
      const pricePerSession = isTrainer ? (st.pricePerSession ?? 500000) : null;
      const commissionRate = isTrainer ? (st.commissionPT ?? 0) : null;
      const commissionToday = isTrainer && trainings.length ? (commissionRate > 0 ? Math.round(pricePerSession * trainings.length * commissionRate / 100) : pricePerSession * trainings.length) : (isTrainer ? 0 : null);
      ws.addRow({
        stt: idx++,
        fullName: st.fullName || '',
        account: st.account || '',
        phone: st.phone || '',
        email: st.email || '',
        gender: st.gender || '',
        job: st.job?.name || '',
        status: st.status === 'active' ? 'Hoạt động' : 'Nghỉ việc',
        shift: shiftLabel,
        count: recs.length,
        checkIns,
        checkOuts,
        totalHours,
        late: late || '',
        early: early || '',
        overtime: overtime || '',
        locker,
        trainingCount: trainings.length,
        trainingDetail,
        pricePerSession: isTrainer ? pricePerSession.toLocaleString('vi-VN') : '-',
        commissionRate: isTrainer ? `${commissionRate}%` : '-',
        commissionToday: isTrainer ? commissionToday.toLocaleString('vi-VN') : '-',
      });
    }
    ws.eachRow((row, i) => {
      if (i > 1) {
        row.alignment = { vertical: 'middle', wrapText: true };
        row.height = 22;
        if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=NhanVien_HoatDong_${dateStr}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
