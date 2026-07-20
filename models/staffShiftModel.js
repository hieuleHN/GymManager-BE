import StaffShift from './schemas/staffShiftSchema.js';

export const createShift = async (data, callback) => {
  try {
    const existing = await StaffShift.findOne({
      staffId: data.staffId,
      date: new Date(data.date).setHours(0, 0, 0, 0),
      shift: data.shift
    });
    if (existing) return callback({ message: 'Nhân viên đã được phân ca này trong ngày!' });

    const shift = new StaffShift({
      staffId: data.staffId,
      date: data.date,
      shift: data.shift,
      locationId: data.locationId || null,
      notes: data.notes || '',
      assignedBy: data.assignedBy || null
    });
    const saved = await shift.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const getShiftsByDate = async (date, locationId, callback) => {
  try {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const filter = { date: { $gte: start, $lte: end } };
    if (locationId) filter.locationId = locationId;

    const shifts = await StaffShift.find(filter)
      .populate('staffId', 'fullName account avatar job')
      .populate('assignedBy', 'fullName')
      .sort({ createdAt: -1 });
    callback(null, shifts);
  } catch (err) {
    callback(err);
  }
};

export const getShiftsByDateRange = async (startDate, endDate, locationId, callback) => {
  try {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filter = { date: { $gte: start, $lte: end } };
    if (locationId) filter.locationId = locationId;

    const shifts = await StaffShift.find(filter)
      .populate('staffId', 'fullName account avatar job')
      .populate('assignedBy', 'fullName')
      .sort({ date: 1 });
    callback(null, shifts);
  } catch (err) {
    callback(err);
  }
};

export const getShiftsByStaff = async (staffId, startDate, endDate, callback) => {
  try {
    const filter = { staffId };
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate).setHours(0, 0, 0, 0),
        $lte: new Date(endDate).setHours(23, 59, 59, 999)
      };
    }
    const shifts = await StaffShift.find(filter)
      .populate('staffId', 'fullName account')
      .sort({ date: 1 });
    callback(null, shifts);
  } catch (err) {
    callback(err);
  }
};

export const deleteShift = async (id, callback) => {
  try {
    const shift = await StaffShift.findByIdAndDelete(id);
    if (!shift) return callback({ message: 'Không tìm thấy ca làm việc!' });
    callback(null, { success: true });
  } catch (err) {
    callback(err);
  }
};

export const bulkCreateShifts = async (entries, callback) => {
  try {
    const results = { success: 0, failed: 0, errors: [] };
    for (const entry of entries) {
      try {
        const existing = await StaffShift.findOne({
          staffId: entry.staffId,
          date: new Date(entry.date).setHours(0, 0, 0, 0),
          shift: entry.shift
        });
        if (existing) {
          results.failed++;
          results.errors.push(`${entry.staffName || entry.staffId}: Đã tồn tại`);
          continue;
        }
        await new StaffShift(entry).save();
        results.success++;
      } catch {
        results.failed++;
        results.errors.push(`${entry.staffName || entry.staffId}: Lỗi`);
      }
    }
    callback(null, results);
  } catch (err) {
    callback(err);
  }
};
