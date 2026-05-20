import db from '../config/db.js';

// 1. Lấy tất cả cơ sở kèm danh sách ảnh và mô tả chi tiết
export const getAll = (callback) => {
  const sql = `
    SELECT l.*, 
           IF(COUNT(li.id) > 0, 
              CONCAT('[', GROUP_CONCAT(JSON_OBJECT('url', li.image, 'description', li.description)), ']'), 
              '[]') AS images_json
    FROM location l
    LEFT JOIN location_images li ON l.id = li.location_id
    GROUP BY l.id
  `;
  db.query(sql, (err, results) => {
    if (err) return callback(err);

    const formattedResults = results.map(row => {
      const formattedRow = { ...row };
      // Chuyển chuỗi JSON thành mảng Object cho Frontend dễ dùng
      formattedRow.images = JSON.parse(row.images_json || '[]');
      delete formattedRow.images_json; // Xóa bỏ cột tạm
      return formattedRow;
    });

    callback(null, formattedResults);
  });
};

// 2. Lấy chi tiết một cơ sở kèm mảng ảnh + mô tả
export const getById = (id, callback) => {
  const sql = `
    SELECT l.*, 
           IF(COUNT(li.id) > 0, 
              CONCAT('[', GROUP_CONCAT(JSON_OBJECT('url', li.image, 'description', li.description)), ']'), 
              '[]') AS images_json
    FROM location l
    LEFT JOIN location_images li ON l.id = li.location_id
    WHERE l.id = ?
    GROUP BY l.id
  `;
  db.query(sql, [id], (err, results) => {
    if (err) return callback(err);
    if (results.length === 0) return callback(null, []);
    
    const row = results[0];
    row.images = JSON.parse(row.images_json || '[]');
    delete row.images_json;

    callback(null, [row]);
  });
};

// 3. Tạo cơ sở mới ĐỒNG THỜI lưu một loạt ảnh + mô tả (Dùng Transaction)
// Mẹo: imageDataArrays sẽ là mảng các object: [{ url: 'ten_anh.jpg', description: 'Mô tả' }]
export const createWithImages = (locationData, imageDataArrays, callback) => {
  const { address, phone } = locationData;

  db.beginTransaction((err) => {
    if (err) return callback(err);

    // Bước A: Chèn thông tin cơ sở
    db.query('INSERT INTO location (address, phone) VALUES (?, ?)', [address, phone], (err, result) => {
      if (err) return db.rollback(() => callback(err));

      const locationId = result.insertId;

      // Nếu không có ảnh nào được truyền vào
      if (!imageDataArrays || imageDataArrays.length === 0) {
        return db.commit((err) => {
          if (err) return db.rollback(() => callback(err));
          callback(null, { insertId: locationId });
        });
      }

      // Bước B: Chuẩn bị mảng 3 tham số để insert hàng loạt: [location_id, image, description]
      const imageRecords = imageDataArrays.map(img => [locationId, img.url, img.description || null]);
      const sqlImages = 'INSERT INTO location_images (location_id, image, description) VALUES ?';

      db.query(sqlImages, [imageRecords], (err) => {
        if (err) return db.rollback(() => callback(err));

        db.commit((err) => {
          if (err) return db.rollback(() => callback(err));
          callback(null, { insertId: locationId });
        });
      });
    });
  });
};

// 4. Cập nhật cơ sở và thay mới bộ ảnh
export const updateWithImages = (id, locationData, imageDataArrays, callback) => {
  const { address, phone } = locationData;

  db.beginTransaction((err) => {
    if (err) return callback(err);

    // Bước A: Lấy danh sách tên file ảnh cũ ra để tí nữa Controller dọn dẹp ổ cứng
    db.query('SELECT image FROM location_images WHERE location_id = ?', [id], (err, oldImages) => {
      if (err) return db.rollback(() => callback(err));

      const oldImageFiles = oldImages.map(img => img.image);

      // Bước B: Cập nhật thông tin text của cơ sở
      db.query('UPDATE location SET address = ?, phone = ? WHERE id = ?', [address, phone, id], (err, result) => {
        if (err) return db.rollback(() => callback(err));
        if (result.affectedRows === 0) return db.rollback(() => callback(new Error('NotFound')));

        // Bước C: Nếu có cập nhật bộ ảnh mới, xóa ảnh cũ trong DB và chèn chuỗi ảnh + mô tả mới vào
        if (imageDataArrays && imageDataArrays.length > 0) {
          db.query('DELETE FROM location_images WHERE location_id = ?', [id], (err) => {
            if (err) return db.rollback(() => callback(err));

            const imageRecords = imageDataArrays.map(img => [id, img.url, img.description || null]);
            const sqlImages = 'INSERT INTO location_images (location_id, image, description) VALUES ?';

            db.query(sqlImages, [imageRecords], (err) => {
              if (err) return db.rollback(() => callback(err));

              db.commit((err) => {
                if (err) return db.rollback(() => callback(err));
                callback(null, { affectedRows: result.affectedRows, oldFiles: oldImageFiles });
              });
            });
          });
        } else {
          // Nếu không truyền ảnh mới, giữ nguyên bộ ảnh cũ
          db.commit((err) => {
            if (err) return db.rollback(() => callback(err));
            callback(null, { affectedRows: result.affectedRows, oldFiles: [] });
          });
        }
      });
    });
  });
};

// 5. Xóa cơ sở (Xóa dữ liệu DB và trả về danh sách file để controller xóa vật lý)
export const remove = (id, callback) => {
  db.beginTransaction((err) => {
    if (err) return callback(err);

    // BƯỚC 1: Thu thập rác vật lý (Lấy tên file ảnh của Location và Services để xóa ổ cứng)
    // 1.1 Lấy ảnh của Location
    db.query('SELECT image FROM location_images WHERE location_id = ?', [id], (err, locImgRows) => {
      if (err) return db.rollback(() => callback(err));
      const locationFiles = locImgRows.map(row => row.image);

      // 1.2 Lấy ảnh của tất cả Services thuộc Location này
      db.query('SELECT image FROM service_images WHERE service_id IN (SELECT id FROM services WHERE location_id = ?)', [id], (err, srvImgRows) => {
        if (err) return db.rollback(() => callback(err));
        const serviceFiles = srvImgRows.map(row => row.image);

        // BƯỚC 2: Xóa dữ liệu từ nhánh con (lá) ngược lên gốc bằng Subquery
        // 2.1 Xóa lịch sử mua gói (user_package)
        db.query('DELETE FROM user_package WHERE package_id IN (SELECT id FROM packages WHERE service_id IN (SELECT id FROM services WHERE location_id = ?))', [id], (err) => {
          if (err) return db.rollback(() => callback(err));

          // 2.2 Xóa danh sách gói tập (packages)
          db.query('DELETE FROM packages WHERE service_id IN (SELECT id FROM services WHERE location_id = ?)', [id], (err) => {
            if (err) return db.rollback(() => callback(err));

            // 2.3 Xóa ảnh dịch vụ (service_images)
            db.query('DELETE FROM service_images WHERE service_id IN (SELECT id FROM services WHERE location_id = ?)', [id], (err) => {
              if (err) return db.rollback(() => callback(err));

              // 2.4 Xóa dịch vụ (services)
              db.query('DELETE FROM services WHERE location_id = ?', [id], (err) => {
                if (err) return db.rollback(() => callback(err));

                // 2.5 Xóa dữ liệu ở bảng trung gian (nếu bạn vẫn giữ bảng user_location_service)
                  db.query('DELETE FROM user_location_service WHERE user_location_id IN (SELECT id FROM user_location WHERE location_id = ?)', [id], (err) => {
                    if (err) return db.rollback(() => callback(err));
                
                    // 2.5 Xóa dữ liệu ở bảng trung gian (nếu bạn vẫn giữ bảng user_location)
                    db.query('DELETE FROM user_location WHERE location_id = ?', [id], (err) => {
                    if (err) return db.rollback(() => callback(err));

                  // 2.6 Xóa ảnh cơ sở (location_images)
                  db.query('DELETE FROM location_images WHERE location_id = ?', [id], (err) => {
                    if (err) return db.rollback(() => callback(err));

                    // 2.7 BƯỚC CUỐI CÙNG: Xóa gốc cơ sở (location)
                    db.query('DELETE FROM location WHERE id = ?', [id], (err, result) => {
                      if (err) return db.rollback(() => callback(err));

                      // Lưu vĩnh viễn và trả về 2 mảng file rác riêng biệt
                      db.commit((commitErr) => {
                        if (commitErr) return db.rollback(() => callback(commitErr));
                        callback(null, { 
                          affectedRows: result.affectedRows, 
                          locationFiles, 
                          serviceFiles 
                        });
                      });
                    });
                  });
                });});
              });
            });
          });
        });
      });
    });
  });
};