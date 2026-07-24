import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';

// Middleware 1: Xác thực xem người dùng đã đăng nhập chưa (Authentication)
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader
    ? authHeader.split('Bearer ')[1]
    : req.query.token; // fallback: token từ query param (dùng cho PDF, file)

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

// Middleware 3: Chỉ cho phép admin/quản lý (dựa vào cờ isAdmin đã ký trong token khi login)
// Dùng cờ isAdmin thay vì so khớp tên "role" vì role hiện là tên công việc (PT, Lễ tân...),
// không cố định là chuỗi "admin" nên authorizeRoles('admin') sẽ không hoạt động đúng.
export const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền thực hiện hành động này!' });
  }
  next();
};

