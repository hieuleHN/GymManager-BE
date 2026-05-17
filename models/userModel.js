import db from '../config/db.js';

// Hàm kiểm tra trùng lặp email/sđt giữ nguyên
export const checkExistingUser = (email, phone, callback) => {
  const sql = 'SELECT * FROM users WHERE email = ? OR phone = ?';
  db.query(sql, [email, phone], callback);
};

// Hàm tìm kiếm user theo tên đăng nhập giữ nguyên
export const findUserByUsername = (username, callback) => {
  const sql = 'SELECT * FROM users WHERE username = ?';
  db.query(sql, [username], callback);
};

// HÀM TẠO USER MỚI (ĐÃ SỬA THEO THIẾT KẾ CỦA BẠN)
export const createUser = (userData, callback) => {
  const { username, email, phone, password, role_id, location_id, service_id } = userData;

  // Bắt đầu một Transaction (Giao dịch an toàn)
  db.beginTransaction((err) => {
    if (err) return callback(err);

    // Bước 1: Thêm tài khoản vào bảng users (Dùng role_id thay vì role)
    const sqlUser = 'INSERT INTO users (username, email, phone, password, role_id) VALUES (?, ?, ?, ?, ?)';
    
    // Giả sử trong DB của bạn ID = 1 là quyền 'Member' mặc định
    const defaultRoleId = role_id || 1; 

    db.query(sqlUser, [username, email, phone, password, defaultRoleId], (err, userResult) => {
      if (err) {
        return db.rollback(() => callback(err)); // Lỗi thì hủy toàn bộ thao tác
      }

      // Lấy ID tự động tăng (user_id) của người dùng vừa được tạo thành công
      const newUserId = userResult.insertId;

      // Bước 2: Thêm dữ liệu vào bảng trung gian user_location_service
      const sqlIntermediate = 'INSERT INTO user_location_service (user_id, location_id, service_id) VALUES (?, ?, ?)';
      
      db.query(sqlIntermediate, [newUserId, location_id, service_id], (err, intermediateResult) => {
        if (err) {
          return db.rollback(() => callback(err)); // Nếu lỗi bảng trung gian, hủy luôn tài khoản user vừa tạo ở trên
        }

        // Nếu cả 2 bước đều thành công tốt đẹp -> Lưu vĩnh viễn vào DB
        db.commit((err) => {
          if (err) {
            return db.rollback(() => callback(err));
          }
          // Trả về kết quả thành công
          callback(null, { userId: newUserId });
        });
      });
    });
  });
};