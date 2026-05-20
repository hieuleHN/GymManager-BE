import db from '../config/db.js';

// 1. API GET: Lấy danh sách gói tập dựa trên Location của User
export const getAvailablePackagesByUserId = (userId, callback) => {
  // Lưu ý: Giả định bảng services có chứa cột location_id (hoặc có bảng trung gian location_service).
  // Dưới đây là câu query join trực tiếp từ user_location -> locations -> services -> packages.
  const sql = `
    SELECT 
      s.id AS service_id,
      s.name AS service_name,
      p.id AS package_id,
      p.name AS package_name,
      p.price,
      p.description,
      p.duration_days,
      p.is_active
    FROM user_location ul
    JOIN location l ON ul.location_id = l.id
    JOIN services s ON s.location_id = l.id 
    JOIN packages p ON s.id = p.service_id
    WHERE ul.user_id = ? AND p.is_active = 1
    ORDER BY s.id ASC, p.price ASC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

// 2. API POST: Xử lý mua gói - Cập nhật đồng thời user_package và user_location_service
export const subscribePackage = (userId, packageId, callback) => {
  // Bắt đầu Transaction vì chúng ta phải INSERT vào 2 bảng khác nhau
  db.beginTransaction((err) => {
    if (err) return callback(err);

    // Bước 1: Lấy thông tin gói tập (duration_days, service_id) VÀ lấy ID của bảng user_location của user này
    const sqlGetInfo = `
      SELECT 
        p.duration_days, 
        p.is_active, 
        p.service_id,
        ul.id AS user_location_id
      FROM packages p
      LEFT JOIN user_location ul ON ul.user_id = ?
      WHERE p.id = ?
      LIMIT 1
    `;

    db.query(sqlGetInfo, [userId, packageId], (err, results) => {
      if (err) return db.rollback(() => callback(err));
      
      if (results.length === 0) {
        return db.rollback(() => callback(new Error('Gói tập không tồn tại hoặc tài khoản chưa được gắn với cơ sở (location) nào!')));
      }
      if (results[0].is_active === 0) {
        return db.rollback(() => callback(new Error('Gói tập này hiện tại đang tạm ngưng áp dụng!')));
      }

      const { duration_days, service_id, user_location_id } = results[0];

      if (!user_location_id) {
        return db.rollback(() => callback(new Error('Không tìm thấy bản ghi user_location của bạn. Vui lòng cập nhật cơ sở trước khi mua gói!')));
      }

      // Bước 2: Thêm bản ghi vào bảng user_package
      const sqlInsertPackage = `
        INSERT INTO user_package (user_id, package_id, start_date, end_date, status, created_at)
        VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), 'đang hoạt động', NOW())
      `;

      db.query(sqlInsertPackage, [userId, packageId, duration_days], (err, packageResult) => {
        if (err) return db.rollback(() => callback(err));

        // Bước 3: Thêm bản ghi vào bảng user_location_service
        const sqlInsertLocationService = `
          INSERT INTO user_location_service (user_location_id, service_id)
          VALUES (?, ?)
        `;

        db.query(sqlInsertLocationService, [user_location_id, service_id], (err, locServiceResult) => {
          if (err) return db.rollback(() => callback(err));

          // Bước 4: Hoàn tất Transaction
          db.commit((commitErr) => {
            if (commitErr) return db.rollback(() => callback(commitErr));
            callback(null, packageResult); // Trả về kết quả thành công
          });
        });
      });
    });
  });
};