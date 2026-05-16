import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Kích hoạt biến môi trường từ file .env
dotenv.config();

const app = express();
app.use(express.json()); // Middleware để đọc dữ liệu JSON gửi lên từ Frontend

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';
const PORT = process.env.PORT || 5000;

// ==========================================
// MOCK DATA (Mảng tạm - Sau này nhóm bạn chèn câu lệnh SQL vào đây)
// ==========================================
let users = []; 

// ==========================================
// MIDDLEWARES XÁC THỰC & PHÂN QUYỀN
// ==========================================

// 1. Xác thực xem Token người dùng gửi lên có hợp lệ không (Authentication)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Lấy chuỗi mã sau chữ 'Bearer '

  if (!token) return res.status(401).json({ message: 'Bạn chưa đăng nhập. Vui lòng gửi kèm Token!' });

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
    
    req.user = decodedUser; // Lưu thông tin người dùng (id, role) vào req để các chức năng sau xài
    next();
  });
};

// 2. Kiểm tra xem vai trò (Role) có khớp để vào tính năng không (Authorization)
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Hành động bị từ chối! Bạn không có quyền truy cập.' });
    }
    next();
  };
};

// ==========================================
// CÁC API CỐT LÕI (ĐĂNG KÝ / ĐĂNG NHẬP)
// ==========================================

// 1. API Đăng ký tài khoản (Dành cho Khách vãng lai trên Website)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    // [SQL PLACEHOLDER]: Thực hiện câu lệnh SELECT kiểm tra trùng Email/SĐT trong bảng Users
    const userExists = users.find(u => u.email === email || u.phone === phone);
    if (userExists) return res.status(400).json({ message: 'Email hoặc Số điện thoại đã được đăng ký!' });

    // Mã hóa mật khẩu tăng tính bảo mật cho hệ thống
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Chuẩn bị object để lưu (Khi bạn tự viết bảng SQL, các trường này tương ứng các cột)
    const newUser = {
      id: Date.now(), // [SQL]: AUTO_INCREMENT tự tăng
      username,
      email,
      phone,
      password: hashedPassword,
      role: 'Member' // Mặc định khách tự đăng ký trên web sẽ thành Hội viên (Member)
    };

    // [SQL PLACEHOLDER]: Thực hiện lệnh INSERT INTO Users...
    users.push(newUser); 

    res.status(201).json({ message: 'Đăng ký tài khoản Hội viên thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ!', error: error.message });
  }
});

// 2. API Đăng nhập truyền thống (Nhận diện user và trả về "Hộ chiếu" JWT)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // [SQL PLACEHOLDER]: Thực hiện lệnh SELECT * FROM Users WHERE email = ?
    const user = users.find(u => u.email === email);
    if (!user) return res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác!' });

    // Giải mã và so sánh mật khẩu
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Email hoặc mật khẩu không chính xác!' });

    // Ký mã Token JWT: Gói ID, Quyền và Tên vào một chuỗi mã hóa
    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: '3d' } // Token có hiệu lực 3 ngày
    );

    // Trả Token về cho Frontend lưu lại ở LocalStorage hoặc Cookie
    res.status(200).json({
      message: 'Đăng nhập thành công!',
      token: token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi hệ thống đăng nhập!' });
  }
});

// ==========================================
// THỬ NGHIỆM ĐỂ CÁC THÀNH VIÊN KHÁC TRONG NHÓM DỄ HÌNH DUNG
// ==========================================

// Ví dụ: API Đặt lịch PT (Chỉ Hội viên đã đăng nhập mới gọi được)
app.post('/api/member/booking', authenticateToken, authorizeRoles('Member'), (req, res) => {
    const memberId = req.user.id; // Lấy trực tiếp từ token mà không cần bắt FE gửi lên
    res.json({ message: `Hội viên số ${memberId} đã kích hoạt tính năng đặt lịch PT thành công.` });
});

// Ví dụ: API Xem doanh thu (Chỉ Admin và Manager được vào)
app.get('/api/admin/revenue', authenticateToken, authorizeRoles('Admin', 'Manager'), (req, res) => {
    res.json({ message: "Dữ liệu thống kê doanh thu phòng tập bảo mật." });
});

// Chạy server
app.listen(PORT, () => {
  console.log(`🚀 Server Express (ES Modules) đang chạy tại: http://localhost:${PORT}`);
});