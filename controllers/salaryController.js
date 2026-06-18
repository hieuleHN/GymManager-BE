import {
  getSalaryDetails, updateSalary, paySalary, getSalaryHistory, getSalaryHistoryByStaff
} from '../models/salaryModel.js';

export const details = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  getSalaryDetails(page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

export const update = (req, res) => {
  const { staffId, baseSalary } = req.body;
  if (!staffId || !baseSalary || baseSalary <= 0) {
    return res.status(400).json({ error: 'Vui lòng chọn nhân viên và nhập lương hợp lệ!' });
  }
  updateSalary(staffId, baseSalary, (err, result) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi cập nhật lương!' });
    res.json({ message: 'Cập nhật lương thành công!' });
  });
};

export const pay = (req, res) => {
  const { staffId } = req.body;
  if (!staffId) {
    return res.status(400).json({ error: 'Vui lòng chọn nhân viên!' });
  }
  const paidBy = req.user.id;
  paySalary(staffId, paidBy, (err, result) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi trả lương!' });
    res.json({ message: 'Trả lương thành công! Tiền thưởng đã được reset về 0.' });
  });
};

export const history = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  getSalaryHistory(page, limit, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
};

export const historyByStaff = (req, res) => {
  const { staffId } = req.params;
  getSalaryHistoryByStaff(staffId, (err, data) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(data);
  });
};