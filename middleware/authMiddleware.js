import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';

// Middleware 1: Xác thực xem người dùng đã đăng nhập chưa (Authentication)
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split('Bearer ')[1]; // Lấy token từ chuỗi 'Bearer <token>'

  if (!token) {
    return res.status(401).json({ error: 'Bạn chưa đăng nhập. Hãy đính kèm token!' });
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) return res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn!'+token });
    
    req.user = decodedUser; // Lưu thông tin người dùng vào request để sử dụng ở các hàm tiếp theo
    next();
  });
};

// Middleware 2: Kiểm tra quyền hạn truy cập (Authorization)
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Hành động bị từ chối! Bạn không đủ thẩm quyền.' });
    }
    next();
  };
};

