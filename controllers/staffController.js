import {
  createStaff, getAllStaff, getStaffById, updateStaffById, deleteStaffById, findStaffByAccount
} from '../models/staffModel.js';
import { getJobById } from '../models/jobModel.js';
import { getPermissionsByJob } from '../models/permissionModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import {getTrainers} from '../models/staffModel.js';

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';

export const listTrainers = (req, res) => {
  getTrainers((err, trainers) => {
      if (err) return res.status(500).json({ error: 'Lỗi lấy danh sách: ' + err.message });
      res.json(trainers);
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

      getPermissionsByJob(jobId, (err, permission) => {
        let permissions = [];
        if (permission && permission.permissions) {
          permissions = permission.permissions
            .filter(p => p.actions && p.actions.length > 0)
            .map(p => p.feature);
        }

        const token = jwt.sign(
          { id: staff._id, role: staff.job?.name || 'staff', username: staff.account, isStaff: true, jobId, isAdmin },
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
            permissions
          }
        });
      });
    });
  });
};

export const list = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const { locationId } = req.query;
  getAllStaff(page, limit, locationId || null, (err, result) => {
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
  const { account, password, fullName, email, phone, gender, job, startDate, address, baseSalary, locationId } = req.body;
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
  const staffData = { account, password, fullName, email, phone, gender, job, startDate, address, baseSalary, locationId };
  createStaff(staffData, (err, result) => {
    if (err) return res.status(400).json({ error: err.message || 'Lỗi thêm nhân viên!' });
    res.status(201).json({ message: 'Thêm nhân viên thành công!', staffId: result.staffId });
  });
};

export const update = (req, res) => {
  const { fullName, email, phone, gender, job, startDate, address, baseSalary, bonus, status } = req.body;
  const data = { fullName, email, phone, gender, job, startDate, address, baseSalary, bonus, status };
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