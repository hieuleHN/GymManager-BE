import db from '../config/db.js';

// 1. CREATE: Tạo một gói tập mới
export const createPackage = (packageData, callback) => {
  const { name, price, description, duration_days, is_active, service_id } = packageData;
  const sql = `
    INSERT INTO packages (name, price, description, duration_days, is_active, service_id) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  // Mặc định is_active = 1 (true) nếu không truyền vào
  const activeStatus = is_active !== undefined ? is_active : 1;

  db.query(sql, [name, price, description, duration_days, activeStatus, service_id], callback);
};

// 2. READ (Danh sách): Lấy toàn bộ danh sách gói tập
export const getAllPackages = (callback) => {
  const sql = `
    SELECT p.*, s.name AS service_name 
    FROM packages p
    LEFT JOIN services s ON p.service_id = s.id
    ORDER BY p.id DESC
  `;
  db.query(sql, callback);
};

// 3. READ (Chi tiết + JOIN): Xem chi tiết gói tập kèm danh sách người mua (hội viên)
export const getPackageById = (id, callback) => {
  const sql = `
    SELECT 
      p.id AS package_id,
      p.name AS package_name,
      p.price,
      p.description,
      p.duration_days,
      p.is_active,
      p.service_id,
      up.id AS user_package_id,
      up.start_date,
      up.end_date,
      up.status AS purchase_status,
      up.created_at AS purchase_date,
      u.id AS user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.phone
    FROM packages p
    LEFT JOIN user_package up ON p.id = up.package_id
    LEFT JOIN users u ON up.user_id = u.id
    WHERE p.id = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results); 
    // Trả về toàn bộ dòng kết quả thô để Controller xử lý gộp mảng hội viên
  });
};

// 4. UPDATE: Cập nhật thông tin gói tập
export const updatePackageById = (id, packageData, callback) => {
  const { name, price, description, duration_days, is_active, service_id } = packageData;
  const sql = `
    UPDATE packages 
    SET name = ?, price = ?, description = ?, duration_days = ?, is_active = ?, service_id = ? 
    WHERE id = ?
  `;
  db.query(sql, [name, price, description, duration_days, is_active, service_id, id], callback);
};

// 5. DELETE: Xóa gói tập (Dùng Transaction để dọn sạch bảng trung gian user_package trước)
export const deletePackageById = (id, callback) => {
  const sqlDeleteUserPackage = 'DELETE FROM user_package WHERE package_id = ?';
  const sqlDeletePackage = 'DELETE FROM packages WHERE id = ?';

  db.beginTransaction((err) => {
    if (err) return callback(err);

    // Bước 1: Xóa toàn bộ liên kết người dùng sử dụng gói tập này trước
    db.query(sqlDeleteUserPackage, [id], (err, userPackageResult) => {
      if (err) return db.rollback(() => callback(err));

      // Bước 2: Xóa chính thức gói tập khỏi hệ thống
      db.query(sqlDeletePackage, [id], (err, packageResult) => {
        if (err) return db.rollback(() => callback(err));

        db.commit((commitErr) => {
          if (commitErr) return db.rollback(() => callback(commitErr));
          callback(null, packageResult);
        });
      });
    });
  });
};