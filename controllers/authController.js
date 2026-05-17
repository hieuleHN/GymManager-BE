import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { checkExistingUser, createUser, findUserByUsername } from '../models/userModel.js';

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';

// 1. Logic Đăng ký tài khoản (Dành cho khách vãng lai)
export const register = (req, res) => {
  // Lấy thêm location_id và service_id từ body do khách chọn lúc đăng ký
  const { username, email, phone, password, role_id, location_id, service_id } = req.body;

  // Kiểm tra validate đầu vào dữ liệu đầu vào
  if (!username || !email || !phone || !password || !role_id || !location_id || !service_id) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin đăng ký và chọn cơ sở/dịch vụ!' });
  }

  // Check trùng email/sđt trước
  checkExistingUser(email, phone, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
      return res.status(400).json({ error: 'Email hoặc Số điện thoại này đã được sử dụng!' });
    }

    // Mã hóa mật khẩu bảo mật
    bcrypt.genSalt(10, (err, salt) => {
      if (err) return res.status(500).json({ error: err.message });
      bcrypt.hash(password, salt, (err, hashedPassword) => {
        if (err) return res.status(500).json({ error: err.message });

        // Đóng gói data để chuyển xuống Model xử lý Transaction
        const newUserPayload = {
          username,
          email,
          phone,
          password: hashedPassword,
          role_id, 
          location_id,
          service_id
        };

        createUser(newUserPayload, (err, result) => {
          if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi lưu thông tin: ' + err.message });
          
          res.status(201).json({ 
            message: 'Đăng ký tài khoản và chọn cơ sở tập thành công!',
            userId: result.userId
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