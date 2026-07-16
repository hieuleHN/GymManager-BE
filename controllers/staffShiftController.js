import {
  createShift, getShiftsByDate, getShiftsByDateRange, getShiftsByStaff, deleteShift, bulkCreateShifts
} from '../models/staffShiftModel.js';

export const create = (req, res) => {
  const { staffId, date, shift, locationId, notes } = req.body;
  if (!staffId || !date || !shift) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin!' });
  }
  createShift({ staffId, date, shift, locationId, notes, assignedBy: req.user?.id }, (err, result) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi thêm ca làm việc!' });
    res.status(201).json({ message: 'Phân ca thành công!', data: result });
  });
};

export const listByDate = (req, res) => {
  const { date, locationId } = req.query;
  if (!date) return res.status(400).json({ error: 'Vui lòng chọn ngày!' });
  getShiftsByDate(date, locationId || null, (err, shifts) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: shifts });
  });
};

export const listByDateRange = (req, res) => {
  const { startDate, endDate, locationId } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'Vui lòng chọn khoảng ngày!' });
  getShiftsByDateRange(startDate, endDate, locationId || null, (err, shifts) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: shifts });
  });
};

export const listByStaff = (req, res) => {
  const { staffId, startDate, endDate } = req.query;
  if (!staffId) return res.status(400).json({ error: 'Vui lòng chọn nhân viên!' });
  getShiftsByStaff(staffId, startDate, endDate, (err, shifts) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: shifts });
  });
};

export const remove = (req, res) => {
  deleteShift(req.params.id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Xóa ca làm việc thành công!' });
  });
};

export const bulkCreate = (req, res) => {
  const { entries } = req.body;
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'Vui lòng cung cấp danh sách phân ca!' });
  }
  const enriched = entries.map(e => ({ ...e, assignedBy: req.user?.id }));
  bulkCreateShifts(enriched, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Phân ca: ${result.success} thành công, ${result.failed} thất bại`, result });
  });
};
