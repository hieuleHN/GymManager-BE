import {
  createCustomer, getAllCustomers, getCustomerById, updateCustomerById, deleteCustomerById,
  approveCustomer, rejectCustomer, getPendingCustomers, submitPersonalInfo
} from '../models/customerModel.js';
import fs from 'fs';
import path from 'path';

export const register = (req, res) => {
  const { account, password, locationId } = req.body;
  if (!account || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tài khoản và mật khẩu!' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự!' });
  }

  createCustomer({ account, password, locationId }, (err, result) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Lỗi đăng ký!' });
    }
    res.status(201).json({ message: 'Đăng ký thành công! Bạn có thể đăng nhập ngay.', customerId: result.customerId });
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

export const myInfo = (req, res) => {
  const customerId = req.user.id;
  getCustomerById(customerId, (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy thông tin!' });
    res.json(customer);
  });
};

export const submitInfo = (req, res) => {
  const customerId = req.user.id;
  const { fullName, gender, phone, email, address, idNumber } = req.body;
  if (!fullName || !phone || !email) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ họ tên, số điện thoại và email!' });
  }
  const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ!' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email không hợp lệ!' });
  }

  submitPersonalInfo(customerId, { fullName, gender, phone, email, address, idNumber }, req.files, (err, customer) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi cập nhật thông tin!' });
    res.json({ message: 'Gửi thông tin thành công! Vui lòng chờ nhân viên xác nhận.', customer });
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
    if (result.idCardFront) fs.unlink(path.join('uploads', 'customers', result.idCardFront), () => {});
    if (result.idCardBack) fs.unlink(path.join('uploads', 'customers', result.idCardBack), () => {});
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
  rejectCustomer(id, reason || 'Thông tin không đúng', (err, customer) => {
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
