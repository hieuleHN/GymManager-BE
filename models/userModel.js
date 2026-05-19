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

export const getAllUsers = (callback) => {
  const sql = `
    SELECT 
      u.username,
      u.first_name,
      u.last_name,
      u.avatar,
      u.email,
      u.phone, 
      r.name AS role_name,
      l.address AS location_name,
      s.name AS service_name
    FROM users u
    LEFT JOIN role r ON u.role_id = r.id
    LEFT JOIN user_location_service uls ON u.id = uls.user_id
    LEFT JOIN location l ON uls.location_id = l.id
    LEFT JOIN services s ON uls.service_id = s.id
  `;
  
  db.query(sql, callback);
};

// CHỨC NĂNG 1: LẤY CHI TIẾT NGƯỜI DÙNG / HỒ SƠ NGƯỜI DÙNG
export const getUserById = (id, callback) => {
  const sql = `
    SELECT 
      u.id AS user_id, 
      u.username, 
      u.email, 
      u.phone, 
      u.first_name, 
      u.last_name, 
      u.avatar, 
      u.role_id,
      r.name AS role_name,
      uls.location_id, 
      l.address AS location_name,
      uls.service_id, 
      s.name AS service_name
    FROM users u
    LEFT JOIN role r ON u.role_id = r.id
    LEFT JOIN user_location_service uls ON u.id = uls.user_id
    LEFT JOIN location l ON uls.location_id = l.id
    LEFT JOIN services s ON uls.service_id = s.id
    WHERE u.id = ?
  `;
  
  db.query(sql, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]); // Chỉ trả về 1 đối tượng user duy nhất thay vì mảng
  });
};

// CHỨC NĂNG: XÓA USER KÈM LẤY TÊN ẢNH
export const deleteUserById = (id, callback) => {
  const sqlSelect = 'SELECT avatar FROM users WHERE id = ?'; // (Nếu bảng của bạn cột là id thì sửa user_id thành id nhé)
  const sqlIntermediate = 'DELETE FROM user_location_service WHERE user_id = ?';
  const sqlUser = 'DELETE FROM users WHERE id = ?';

  db.beginTransaction((err) => {
    if (err) return callback(err);

    // Bước 1: Lấy tên file ảnh trước khi xóa
    db.query(sqlSelect, [id], (err, rows) => {
      if (err) return db.rollback(() => callback(err));
      
      const avatarToDelete = rows.length > 0 ? rows[0].avatar : null;

      // Bước 2: Xóa dữ liệu ở bảng trung gian
      db.query(sqlIntermediate, [id], (err) => {
        if (err) return db.rollback(() => callback(err));

        // Bước 3: Xóa tài khoản ở bảng users
        db.query(sqlUser, [id], (err, result) => {
          if (err) return db.rollback(() => callback(err));

          db.commit((commitErr) => {
            if (commitErr) return db.rollback(() => callback(commitErr));
            // Trả về thêm avatarToDelete để Controller dọn rác
            callback(null, { result, avatarToDelete }); 
          });
        });
      });
    });
  });
};

// CHỨC NĂNG: CẬP NHẬT THÔNG TIN VÀ ẢNH
export const updateUserById = (id, userData, hasRolePermission, callback) => {
  const { username, email, phone, first_name, last_name, avatar, role_id, location_id, service_id } = userData;

  db.beginTransaction((err) => {
    if (err) return callback(err);

    // Bước 1: Lấy tên ảnh cũ ra
    db.query('SELECT avatar FROM users WHERE id = ?', [id], (err, rows) => {
      if (err) return db.rollback(() => callback(err));
      
      const oldAvatar = rows.length > 0 ? rows[0].avatar : null;
      
      // Nếu có upload ảnh mới (avatar) -> Lấy ảnh mới. Nếu không -> Giữ lại ảnh cũ (oldAvatar)
      const finalAvatar = avatar ? avatar : oldAvatar;

      let sqlUser = '';
      let paramsUser = [];

      if (hasRolePermission) {
        sqlUser = 'UPDATE users SET username = ?, email = ?, phone = ?, first_name = ?, last_name = ?, avatar = ?, role_id = ? WHERE id = ?';
        paramsUser = [username, email, phone, first_name, last_name, finalAvatar, role_id, id];
      } else {
        sqlUser = 'UPDATE users SET username = ?, email = ?, phone = ?, first_name = ?, last_name = ?, avatar = ? WHERE id = ?';
        paramsUser = [username, email, phone, first_name, last_name, finalAvatar, id];
      }

      // Bước 2: Cập nhật bảng users
      db.query(sqlUser, paramsUser, (err, userResult) => {
        if (err) return db.rollback(() => callback(err));

        // Bước 3: Cập nhật bảng trung gian
        const sqlIntermediate = 'UPDATE user_location_service SET location_id = ?, service_id = ? WHERE user_id = ?';
        db.query(sqlIntermediate, [location_id, service_id, id], (err, intermediateResult) => {
          if (err) return db.rollback(() => callback(err));

          db.commit((commitErr) => {
            if (commitErr) return db.rollback(() => callback(commitErr));
            
            // Nếu CÓ up ảnh mới -> Trả về oldAvatar để Controller xoá. Nếu KHÔNG up ảnh mới -> Trả về null
            const avatarToDelete = avatar ? oldAvatar : null;
            
            callback(null, { message: 'Cập nhật thành công!', avatarToDelete });
          });
        });
      });
    });
  });
};