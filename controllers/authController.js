import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { checkExistingUser, createUser, findUserByEmail } from '../models/userModel.js';

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';

// 1. Logic Đăng ký tài khoản (Dành cho khách vãng lai)
export const register = (req, res) => {
  const { username, email, phone, password } = req.body;

  if (!username || !email || !phone || !password) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin!' });
  }

  // Bước 1: Kiểm tra xem tài khoản đã tồn tại chưa
  checkExistingUser(email, phone, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (results.length > 0) {
      return res.status(400).json({ error: 'Email hoặc Số điện thoại đã được đăng ký!' });
    }

    // Bước 2: Mã hóa mật khẩu bảo mật bằng bcryptjs
    bcrypt.genSalt(10, (err, salt) => {
      if (err) return res.status(500).json({ error: err.message });

      bcrypt.hash(password, salt, (err, hashedPassword) => {
        if (err) return res.status(500).json({ error: err.message });

        // Bước 3: Lưu vào database với role mặc định là 'Member'
        const newUser = { username, email, phone, password: hashedPassword, role: 'Member' };

        createUser(newUser, (err, createResult) => {
          if (err) return res.status(500).json({ error: err.message });
          
          res.status(201).json({ message: 'Đăng ký tài khoản Hội viên thành công!' });
        });
      });
    });
  });
};

// 2. Logic Đăng nhập (Trả về Token JWT)
export const login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập Email và Mật khẩu!' });
  }

  // Bước 1: Tìm user dựa vào Email
  findUserByEmail(email, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length === 0) {
      return res.status(400).json({ error: 'Email hoặc mật khẩu không chính xác!' });
    }

    const user = results[0];

    // Bước 2: So sánh mật khẩu người dùng nhập với mật khẩu băm trong DB
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (!isMatch) {
        return res.status(400).json({ error: 'Email hoặc mật khẩu không chính xác!' });
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