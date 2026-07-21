import StaffAttendance from './schemas/staffAttendanceSchema.js';
import StaffShift from './schemas/staffShiftSchema.js';

const SHIFT_TIMES = {
  'morning-noon':     { start: '06:00', end: '13:30' },
  'afternoon-evening': { start: '13:30', end: '21:00' },
};

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return { h, m };
}

function isLate(checkInDate, shiftStartStr, graceMinutes = 15) {
  const ci = { h: checkInDate.getHours(), m: checkInDate.getMinutes() };
  const ss = parseTime(shiftStartStr);
  const ciTotal = ci.h * 60 + ci.m;
  const ssTotal = ss.h * 60 + ss.m + graceMinutes;
  return ciTotal > ssTotal;
}

export const checkIn = async (staffId, date, locationId) => {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  let existing = await StaffAttendance.findOne({ staffId, date: { $gte: dayStart, $lte: dayEnd } });
  if (existing) return { error: 'Nhân viên đã check-in hôm nay!' };

  let shiftId = null;
  let status = 'checked-in';

  const shift = await StaffShift.findOne({
    staffId,
    date: { $gte: dayStart, $lte: dayEnd }
  });

  if (shift && SHIFT_TIMES[shift.shift]) {
    shiftId = shift._id;
    const { start } = SHIFT_TIMES[shift.shift];
    if (isLate(new Date(), start)) {
      status = 'late';
    }
  }

  const record = await StaffAttendance.create({
    staffId,
    shiftId,
    date: new Date(),
    checkInTime: new Date(),
    locationId,
    status
  });

  return { data: record, isLate: status === 'late' };
};

export const checkOut = async (staffId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setHours(23, 59, 59, 999);

  const record = await StaffAttendance.findOne({
    staffId,
    date: { $gte: today, $lte: tomorrow }
  });

  if (!record) return { error: 'Nhân viên chưa check-in hôm nay!' };
  if (record.checkOutTime) return { error: 'Nhân viên đã check-out rồi!' };

  record.checkOutTime = new Date();
  record.status = 'checked-out';
  await record.save();

  return { data: record };
};

export const getTodayByLocation = async (locationId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setHours(23, 59, 59, 999);

  const q = { date: { $gte: today, $lte: tomorrow } };
  if (locationId) q.locationId = locationId;

  return StaffAttendance.find(q)
    .populate('staffId', 'fullName account job')
    .populate('shiftId', 'shift')
    .sort({ checkInTime: -1 });
};

export const getHistory = async (staffId, page = 1, limit = 20) => {
  const q = staffId ? { staffId } : {};
  const total = await StaffAttendance.countDocuments(q);
  const data = await StaffAttendance.find(q)
    .populate('staffId', 'fullName account')
    .sort({ date: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  return { data, total, page, totalPages: Math.ceil(total / limit) };
};
