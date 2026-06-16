import {
  createCustomer, getAllCustomers, getCustomerById, updateCustomerById, deleteCustomerById,
  approveCustomer, rejectCustomer, getPendingCustomers
} from '../models/customerModel.js';
import fs from 'fs';
import path from 'path';

export const register = (req, res) => {
  const { account, password, fullName, gender, phone, email, address, idNumber, locationId } = req.body;
  if (!account || !password || !fullName || !phone || !email) {
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
  const idCardFront = req.files?.idCardFront ? req.files.idCardFront[0].filename : null;
  const idCardBack = req.files?.idCardBack ? req.files.idCardBack[0].filename : null;

  createCustomer({ account, password, fullName, gender, phone, email, address, idNumber, idCardFront, idCardBack, locationId }, (err, result) => {
    if (err) {
      if (idCardFront) fs.unlink(path.join('uploads', 'customers', idCardFront), () => { });
      if (idCardBack) fs.unlink(path.join('uploads', 'customers', idCardBack), () => { });
      return res.status(400).json({ error: err.message || 'Lỗi đăng ký!' });
    }
    res.status(201).json({ message: 'Đăng ký thành công! Vui lòng chờ nhân viên xác nhận.', customerId: result.customerId });
  });
};

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const { locationId } = req.query;
  getAllCustomers(page, limit, locationId || null, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi lấy danh sách: ' + err.message });
    res.json(result);
  });
};

export const detail = (req, res) => {
  getCustomerById(req.params.id, (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng!' });
    res.json(customer);
  });
};

export const update = (req, res) => {
  const { account, password, fullName, gender, phone, email, address, idNumber } = req.body;
  const data = { account, fullName, gender, phone, email, address, idNumber };
  if (req.files?.idCardFront) data.idCardFront = req.files.idCardFront[0].filename;
  if (req.files?.idCardBack) data.idCardBack = req.files.idCardBack[0].filename;
  updateCustomerById(req.params.id, data, (err, customer) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi cập nhật!' });
    res.json({ message: 'Cập nhật thành công!', customer });
  });
};

export const remove = (req, res) => {
  deleteCustomerById(req.params.id, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    if (result.idCardFront) fs.unlink(path.join('uploads', 'customers', result.idCardFront), () => { });
    if (result.idCardBack) fs.unlink(path.join('uploads', 'customers', result.idCardBack), () => { });
    res.json({ message: 'Xóa khách hàng thành công!' });
  });
};

export const approve = (req, res) => {
  const { id } = req.params;
  const staffId = req.user.id;
  approveCustomer(id, staffId, (err, customer) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Đã xác nhận khách hàng!', customer });
  });
};

export const reject = (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  rejectCustomer(id, reason || 'Không được chấp nhận', (err, customer) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Đã từ chối khách hàng!', customer });
  });
};

export const pendingList = (req, res) => {
  getPendingCustomers((err, customers) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(customers);
  });
};