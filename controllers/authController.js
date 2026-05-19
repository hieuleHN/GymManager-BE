import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { checkExistingUser, createUser, findUserByUsername, getUserById, updateUserById, getAllUsers, deleteUserById} from '../models/userModel.js';
import { getAll as getAllRoles } from '../models/roleModel.js';

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';

// 💡 HÀM HELPER: Dọn dẹp ảnh vật lý (Nhận vào 1 tên file string)
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

// 1. Logic Đăng ký tài khoản (Tự động tìm kiếm role "Hội viên")
export const register = (req, res) => {
  const { username, email, phone, password, location_id, service_id } = req.body;

  if (!username || !email || !phone || !password || !location_id || !service_id) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin đăng ký và chọn cơ sở/dịch vụ!' });
  }

  // Bước 1: Check trùng email/sđt trước
  checkExistingUser(email, phone, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
      return res.status(400).json({ error: 'Email hoặc Số điện thoại này đã được sử dụng!' });
    }

    // Bước 2: Gọi roleModel để lấy ID của quyền "Hội viên" một cách linh động
    getAllRoles((err, roles) => {
      if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi kiểm tra phân quyền: ' + err.message });

      // Tìm role có name là "Hội viên"
      const memberRole = roles.find(role => role.name === 'Hội viên');
      
      if (!memberRole) {
        return res.status(500).json({ error: 'Hệ thống chưa cấu hình nhóm quyền "Hội viên" trong database!' });
      }

      // Lấy id (hoặc role_id tùy theo tên cột trong bảng role của bạn)
      const role_id = memberRole.role_id || memberRole.id;

      // Bước 3: Mã hóa mật khẩu bảo mật
      bcrypt.genSalt(10, (err, salt) => {
        if (err) return res.status(500).json({ error: err.message });
        bcrypt.hash(password, salt, (err, hashedPassword) => {
          if (err) return res.status(500).json({ error: err.message });

          // Bước 4: Đóng gói data chuyển xuống Model xử lý
          const newUserPayload = {
            username,
            email,
            phone,
            password: hashedPassword,
            role_id, // Sử dụng role_id vừa tìm được tự động từ DB
            location_id,
            service_id
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

// 2. Logic Đăng nhập (Trả về Token JWT)
export const login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập Tên đăng nhập và Mật khẩu!' });
  }

  // Bước 1: Tìm user dựa vào Tên đăng nhập
  findUserByUsername(username, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length === 0) {
      return res.status(400).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
    }

    const user = results[0];

    // Bước 2: So sánh mật khẩu người dùng nhập với mật khẩu băm trong DB
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (!isMatch) {
        return res.status(400).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
      }

      // Lấy ra tên cột Khóa chính của bạn (id hoặc user_id tùy theo bảng bạn tạo)
      const userId = user.id || user.user_id;

      // Bước 3: Đăng nhập đúng -> Tiến hành ký mã Token JWT làm "Hộ chiếu"
      const token = jwt.sign(
        { id: userId, role: user.role, username: user.username },
        JWT_SECRET,
        { expiresIn: '3d' } // Token sống trong 3 ngày
      );

      // Trả dữ liệu thành công về cho Frontend
      res.json({
        message: 'Đăng nhập thành công!',
        token: token,
        user: { id: userId, username: user.username, role: user.role }
      });
    });
  });
};

// 3. CHỨC NĂNG: Lấy toàn bộ danh sách users (MỚI BỔ SUNG)
export const listUsers = (req, res) => {
  getAllUsers((err, users) => {
    if (err) return res.status(500).json({ error: 'Lỗi khi lấy danh sách: ' + err.message });
    res.status(200).json(users);
  });
};

// CHỨC NĂNG: Xem hồ sơ chi tiết người dùng
export const getUserDetail = (req, res) => {
  // Có thể xem chi tiết của bất kỳ ai qua ID trên URL: /auth/users/5
  // Hoặc tự xem hồ sơ của chính mình nếu không truyền id (lấy từ mã Token đã đăng nhập)
  const userId = req.params.id || req.user.id; 

  getUserById(userId, (err, user) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống: ' + err.message });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy thông tin người dùng này!' });
    
    res.status(200).json(user);
  });
};

// CHỨC NĂNG: Xóa user
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

    // 💡 Nếu xóa DB thành công, tiến hành xóa sạch ảnh đại diện của user này trên ổ đĩa
    deletePhysicalFile(data.avatarToDelete);

    res.status(200).json({ message: 'Xóa người dùng và dọn dẹp file ảnh thành công!' });
  });
};

// CHỨC NĂNG: Cập nhật thông tin hồ sơ
export const updateUser = (req, res) => {
  // 💡 Bắt lỗi định dạng ảnh từ req (Nếu fileFilter báo lỗi)
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }

  const userId = req.params.id; 
  const { username, email, phone, first_name, last_name, role_id, location_id, service_id } = req.body;

  if (!username || !email || !phone || !location_id || !service_id) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin: Tài khoản, Email, SĐT, Cơ sở và Dịch vụ!' });
  }

  // 💡 Hứng tên file ảnh mới (nếu client có gửi)
  const newAvatar = req.file ? req.file.filename : null;

  const updaterRoleName = req.user.role ? req.user.role.toLowerCase() : '';
  const allowedRolesToChangePermission = ['admin', 'manager', 'quản lý', 'lễ tân'];
  const hasRolePermission = allowedRolesToChangePermission.includes(updaterRoleName);

  const updatePayload = {
    username, email, phone, first_name, last_name,
    avatar: newAvatar, // Truyền tên file ảnh mới (nếu có)
    role_id, location_id, service_id
  };

  updateUserById(userId, updatePayload, hasRolePermission, (err, result) => {
    if (err) {
      // 💡 Bẫy rác: Update DB thất bại -> Xoá ngay ảnh mới vừa upload để tránh file mồ côi
      deletePhysicalFile(newAvatar);
      return res.status(500).json({ error: 'Lỗi hệ thống khi cập nhật: ' + err.message });
    }
    
    // 💡 Update DB thành công -> Model sẽ trả về ảnh cũ (nếu có cập nhật ảnh mới), gọi hàm xóa ảnh cũ đi!
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