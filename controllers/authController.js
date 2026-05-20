import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { checkExistingUser, createUser, findUserByUsername, getUserById, updateUserById, getAllUsers, deleteUserById} from '../models/userModel.js';
import { getAll as getAllRoles } from '../models/roleModel.js';

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';

const deletePhysicalFile = (fileName) => {
  if (!fileName) return;
  const filePath = path.join(process.cwd(), 'uploads', 'users', fileName);
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error(`Không thể xóa file: ${filePath}`, unlinkErr);
      });
    }
  });
};

export const register = (req, res) => {
  // ĐÓN THÊM package_id TỪ CLIENT
  const { username, email, phone, password, location_id, service_id, package_id } = req.body;

  if (!username || !email || !phone || !password || !location_id || !service_id) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin đăng ký và chọn cơ sở/dịch vụ!' });
  }

  checkExistingUser(email, phone, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
      return res.status(400).json({ error: 'Email hoặc Số điện thoại này đã được sử dụng!' });
    }

    getAllRoles((err, roles) => {
      if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi kiểm tra phân quyền: ' + err.message });

      const memberRole = roles.find(role => role.name === 'Hội viên');
      
      if (!memberRole) {
        return res.status(500).json({ error: 'Hệ thống chưa cấu hình nhóm quyền "Hội viên" trong database!' });
      }

      const role_id = memberRole.role_id || memberRole.id;

      bcrypt.genSalt(10, (err, salt) => {
        if (err) return res.status(500).json({ error: err.message });
        bcrypt.hash(password, salt, (err, hashedPassword) => {
          if (err) return res.status(500).json({ error: err.message });

          // Gắn thêm package_id vào Payload
          const newUserPayload = {
            username, email, phone, 
            password: hashedPassword, 
            role_id, location_id, service_id, package_id
          };

          createUser(newUserPayload, (err, result) => {
            if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi lưu thông tin: ' + err.message });
            
            res.status(201).json({ 
              message: 'Đăng ký tài khoản và chọn cơ sở tập thành công dưới quyền Hội viên!',
              userId: result.userId
            });
          });
        });
      });
    });
  });
};

export const login = (req, res) => {
  // [Giữ nguyên logic của bạn]
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập Tên đăng nhập và Mật khẩu!' });
  }

  findUserByUsername(username, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length === 0) {
      return res.status(400).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
    }

    const user = results[0];

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (!isMatch) {
        return res.status(400).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
      }

      const userId = user.id || user.user_id;

      const token = jwt.sign(
        { id: userId, role: user.role, username: user.username },
        JWT_SECRET,
        { expiresIn: '3d' } 
      );

      res.json({
        message: 'Đăng nhập thành công!',
        token: token,
        user: { id: userId, username: user.username, role: user.role }
      });
    });
  });
};

export const listUsers = (req, res) => {
  getAllUsers((err, users) => {
    if (err) return res.status(500).json({ error: 'Lỗi khi lấy danh sách: ' + err.message });
    res.status(200).json(users);
  });
};

export const getUserDetail = (req, res) => {
  const userId = req.params.id || req.user.id; 

  getUserById(userId, (err, user) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy thông tin người dùng này!' });
    
    res.status(200).json(user);
  });
};

export const deleteUser = (req, res) => {
  const userId = req.params.id;
  if (!userId) {
    return res.status(400).json({ error: 'Vui lòng cung cấp ID người dùng cần xóa!' });
  }

  deleteUserById(userId, (err, data) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi xóa người dùng: ' + err.message });
    
    if (data.result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng này hoặc người dùng đã bị xóa trước đó!' });
    }

    deletePhysicalFile(data.avatarToDelete);
    res.status(200).json({ message: 'Xóa người dùng (bao gồm 3 bảng phụ) và dọn dẹp file ảnh thành công!' });
  });
};

export const updateUser = (req, res) => {
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }

  const userId = req.params.id; 
  // ĐÓN THÊM package_id
  const { username, email, phone, first_name, last_name, role_id, location_id, service_id, package_id } = req.body;

  if (!username || !email || !phone || !location_id || !service_id) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin: Tài khoản, Email, SĐT, Cơ sở và Dịch vụ!' });
  }

  const newAvatar = req.file ? req.file.filename : null;
  const updaterRoleName = req.user.role ? req.user.role.toLowerCase() : '';
  const allowedRolesToChangePermission = ['admin', 'manager', 'quản lý', 'lễ tân'];
  const hasRolePermission = allowedRolesToChangePermission.includes(updaterRoleName);

  const updatePayload = {
    username, email, phone, first_name, last_name,
    avatar: newAvatar, 
    role_id, location_id, service_id, package_id
  };

  updateUserById(userId, updatePayload, hasRolePermission, (err, result) => {
    if (err) {
      deletePhysicalFile(newAvatar);
      return res.status(500).json({ error: 'Lỗi hệ thống khi cập nhật: ' + err.message });
    }
    
    if (result.avatarToDelete) {
      deletePhysicalFile(result.avatarToDelete);
    }

    if (hasRolePermission) {
      return res.status(200).json({ message: 'Cập nhật thành công toàn bộ thông tin (admin)!' });
    } else {
      return res.status(200).json({ message: 'Cập nhật thành công! (Hội viên).' });
    }
  });
};