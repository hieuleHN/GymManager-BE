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

// HÀM TẠO USER MỚI (ĐÃ UPDATE THEO ERD MỚI)
export const createUser = (userData, callback) => {
  // Thêm package_id vào để hứng dữ liệu gói tập
  const { username, email, phone, password, role_id, location_id, service_id, package_id } = userData;

  db.beginTransaction((err) => {
    if (err) return callback(err);

    // Bước 1: Thêm vào bảng users
    const sqlUser = 'INSERT INTO users (username, email, phone, password, role_id) VALUES (?, ?, ?, ?, ?)';
    const defaultRoleId = role_id || 1; 

    db.query(sqlUser, [username, email, phone, password, defaultRoleId], (err, userResult) => {
      if (err) return db.rollback(() => callback(err));

      const newUserId = userResult.insertId;

      // Bước 2: Thêm vào bảng user_location
      const sqlUserLocation = 'INSERT INTO user_location (user_id, location_id) VALUES (?, ?)';
      db.query(sqlUserLocation, [newUserId, location_id], (err, locationResult) => {
        if (err) return db.rollback(() => callback(err));

        const newUserLocationId = locationResult.insertId;

        // Bước 3: Thêm vào bảng user_location_service (trỏ tới id của user_location)
        const sqlUserLocationService = 'INSERT INTO user_location_service (user_location_id, service_id) VALUES (?, ?)';
        db.query(sqlUserLocationService, [newUserLocationId, service_id], (err) => {
          if (err) return db.rollback(() => callback(err));

          // Bước 4: Thêm vào bảng user_package (nếu người dùng có chọn gói tập)
          if (package_id) {
            // Mặc định set start_date là ngày hiện tại, các cột khác như end_date/status có thể config DB default hoặc tính toán sau
            const sqlUserPackage = 'INSERT INTO user_package (user_id, package_id, start_date, created_at) VALUES (?, ?, NOW(), NOW())';
            db.query(sqlUserPackage, [newUserId, package_id], (err) => {
              if (err) return db.rollback(() => callback(err));
              
              db.commit((err) => {
                if (err) return db.rollback(() => callback(err));
                callback(null, { userId: newUserId });
              });
            });
          } else {
            // Commit luôn nếu không kèm gói tập
            db.commit((err) => {
              if (err) return db.rollback(() => callback(err));
              callback(null, { userId: newUserId });
            });
          }
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
      s.name AS service_name,
      p.name AS package_name
    FROM users u
    LEFT JOIN role r ON u.role_id = r.id
    LEFT JOIN user_location ul ON u.id = ul.user_id
    LEFT JOIN location l ON ul.location_id = l.id
    LEFT JOIN user_location_service uls ON ul.id = uls.user_location_id
    LEFT JOIN services s ON uls.service_id = s.id
    LEFT JOIN user_package up ON u.id = up.user_id
    LEFT JOIN packages p ON up.package_id = p.id
  `;
  
  db.query(sql, callback);
};

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
      ul.location_id, 
      l.address AS location_name,
      uls.service_id, 
      s.name AS service_name,
      up.package_id,
      p.name AS package_name
    FROM users u
    LEFT JOIN role r ON u.role_id = r.id
    LEFT JOIN user_location ul ON u.id = ul.user_id
    LEFT JOIN location l ON ul.location_id = l.id
    LEFT JOIN user_location_service uls ON ul.id = uls.user_location_id
    LEFT JOIN services s ON uls.service_id = s.id
    LEFT JOIN user_package up ON u.id = up.user_id
    LEFT JOIN packages p ON up.package_id = p.id
    WHERE u.id = ?
  `;
  
  db.query(sql, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]); 
  });
};

// CHỨC NĂNG: XÓA USER (XÓA Ở 3 BẢNG TRUNG GIAN TRƯỚC)
export const deleteUserById = (id, callback) => {
  const sqlSelect = 'SELECT avatar FROM users WHERE id = ?'; 
  
  // Xóa các khóa ngoại từ ngọn (con) đến gốc (cha)
  const sqlDelUserPackage = 'DELETE FROM user_package WHERE user_id = ?';
  const sqlDelUserLocationService = 'DELETE uls FROM user_location_service uls JOIN user_location ul ON uls.user_location_id = ul.id WHERE ul.user_id = ?';
  const sqlDelUserLocation = 'DELETE FROM user_location WHERE user_id = ?';
  const sqlDelUser = 'DELETE FROM users WHERE id = ?';

  db.beginTransaction((err) => {
    if (err) return callback(err);

    db.query(sqlSelect, [id], (err, rows) => {
      if (err) return db.rollback(() => callback(err));
      const avatarToDelete = rows.length > 0 ? rows[0].avatar : null;

      // Xóa ở bảng user_package
      db.query(sqlDelUserPackage, [id], (err) => {
        if (err) return db.rollback(() => callback(err));

        // Xóa ở bảng user_location_service
        db.query(sqlDelUserLocationService, [id], (err) => {
          if (err) return db.rollback(() => callback(err));

          // Xóa ở bảng user_location
          db.query(sqlDelUserLocation, [id], (err) => {
            if (err) return db.rollback(() => callback(err));

            // Cuối cùng: Xóa ở bảng users
            db.query(sqlDelUser, [id], (err, result) => {
              if (err) return db.rollback(() => callback(err));

              db.commit((commitErr) => {
                if (commitErr) return db.rollback(() => callback(commitErr));
                callback(null, { result, avatarToDelete }); 
              });
            });
          });
        });
      });
    });
  });
};

// CHỨC NĂNG: CẬP NHẬT THÔNG TIN VÀ ẢNH
export const updateUserById = (id, userData, hasRolePermission, callback) => {
  const { username, email, phone, first_name, last_name, avatar, role_id, location_id, service_id, package_id } = userData;

  db.beginTransaction((err) => {
    if (err) return callback(err);

    db.query('SELECT avatar FROM users WHERE id = ?', [id], (err, rows) => {
      if (err) return db.rollback(() => callback(err));
      
      const oldAvatar = rows.length > 0 ? rows[0].avatar : null;
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

      // Cập nhật bảng users
      db.query(sqlUser, paramsUser, (err) => {
        if (err) return db.rollback(() => callback(err));

        // Cập nhật bảng user_location
        const sqlLocation = 'UPDATE user_location SET location_id = ? WHERE user_id = ?';
        db.query(sqlLocation, [location_id, id], (err) => {
          if (err) return db.rollback(() => callback(err));

          // Cập nhật bảng user_location_service (dùng Join để lấy đúng user_location_id)
          const sqlService = 'UPDATE user_location_service uls JOIN user_location ul ON uls.user_location_id = ul.id SET uls.service_id = ? WHERE ul.user_id = ?';
          db.query(sqlService, [service_id, id], (err) => {
            if (err) return db.rollback(() => callback(err));

            // Cập nhật bảng user_package (nếu có package_id)
            if (package_id) {
              const sqlPackage = 'UPDATE user_package SET package_id = ? WHERE user_id = ?';
              db.query(sqlPackage, [package_id, id], (err) => {
                if (err) return db.rollback(() => callback(err));
                
                db.commit((commitErr) => {
                  if (commitErr) return db.rollback(() => callback(commitErr));
                  const avatarToDelete = avatar ? oldAvatar : null;
                  callback(null, { message: 'Cập nhật thành công!', avatarToDelete });
                });
              });
            } else {
              db.commit((commitErr) => {
                if (commitErr) return db.rollback(() => callback(commitErr));
                const avatarToDelete = avatar ? oldAvatar : null;
                callback(null, { message: 'Cập nhật thành công!', avatarToDelete });
              });
            }
          });
        });
      });
    });
  });
};