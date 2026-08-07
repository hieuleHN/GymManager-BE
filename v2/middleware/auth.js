const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'Phong_Gym_Master_Key_2026';

// Xác thực token (nếu có) để biết phòng tập hiện tại của người dùng đang đăng nhập.
// Không chặn request khi thiếu/token sai -> req.user = null (quản lý toàn bộ phòng tập),
// giữ tương thích với các luồng gọi API không cần đăng nhập.
const auth = (req, res, next) => {
    req.user = null;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || null);
    if (!token) return next();
    try {
        req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        req.user = null;
    }
    next();
};

module.exports = { auth };
