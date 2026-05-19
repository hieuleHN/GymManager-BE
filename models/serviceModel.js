import db from '../config/db.js';

export const getAll = (callback) => {
  const query = `
    SELECT s.*, GROUP_CONCAT(si.image) AS images
    FROM services s
    LEFT JOIN service_images si ON s.id = si.service_id
    GROUP BY s.id
  `;
  db.query(query, (err, results) => {
    if (err) return callback(err);
    const formattedResults = results.map(row => ({
      ...row,
      images: row.images ? row.images.split(',') : []
    }));
    callback(null, formattedResults);
  });
};

export const getById = (id, callback) => {
  const query = `
    SELECT s.*, GROUP_CONCAT(si.image) AS images
    FROM services s
    LEFT JOIN service_images si ON s.id = si.service_id
    WHERE s.id = ?
    GROUP BY s.id
  `;
  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    if (results.length === 0) return callback(null, []);
    results[0].images = results[0].images ? results[0].images.split(',') : [];
    callback(null, results);
  });
};

export const createWithImages = (data, imageUrls, callback) => {
  const { name, description } = data;
  db.beginTransaction((err) => {
    if (err) return callback(err);

    db.query('INSERT INTO services (name, description) VALUES (?, ?)', [name, description], (err, result) => {
      if (err) return db.rollback(() => callback(err));
      const serviceId = result.insertId;

      if (!imageUrls || imageUrls.length === 0) {
        return db.commit((commitErr) => {
          if (commitErr) return db.rollback(() => callback(commitErr));
          callback(null, result);
        });
      }

      const imageQuery = 'INSERT INTO service_images (service_id, image) VALUES ?';
      const imageValues = imageUrls.map(url => [serviceId, url]);

      db.query(imageQuery, [imageValues], (imgErr) => {
        if (imgErr) return db.rollback(() => callback(imgErr));
        db.commit((commitErr) => {
          if (commitErr) return db.rollback(() => callback(commitErr));
          callback(null, result);
        });
      });
    });
  });
};

// --- HÀM CẬP NHẬT ĐƯỢC NÂNG CẤP Ở ĐÂY ---
export const updateWithImages = (id, data, imageUrls, callback) => {
  const { name, description } = data;

  db.beginTransaction((err) => {
    if (err) return callback(err);

    // Bước 1: Cập nhật thông tin cơ bản của dịch vụ
    db.query('UPDATE services SET name = ?, description = ? WHERE id = ?', [name, description, id], (err, result) => {
      if (err) return db.rollback(() => callback(err));
      if (result.affectedRows === 0) return db.rollback(() => callback(new Error('NOT_FOUND')));

      // Nếu Client không upload ảnh mới, giữ nguyên ảnh cũ và commit luôn
      if (!imageUrls || imageUrls.length === 0) {
        return db.commit((commitErr) => {
          if (commitErr) return db.rollback(() => callback(commitErr));
          callback(null, { affectedRows: result.affectedRows, oldFilesToDelete: [] });
        });
      }

      // Nếu CÓ ảnh mới gửi lên: Tiến hành dây chuyền đổi ảnh
      // Bước 2: Lấy danh sách tên file ảnh cũ ra trước để lát xoá ổ cứng
      db.query('SELECT image FROM service_images WHERE service_id = ?', [id], (err, imageRows) => {
        if (err) return db.rollback(() => callback(err));
        const oldFilesToDelete = imageRows.map(row => row.image);

        // Bước 3: Xoá toàn bộ bản ghi ảnh cũ của dịch vụ này trong DB
        db.query('DELETE FROM service_images WHERE service_id = ?', [id], (err) => {
          if (err) return db.rollback(() => callback(err));

          // Bước 4: Bulk Insert loạt ảnh mới vào bảng service_images
          const imageQuery = 'INSERT INTO service_images (service_id, image) VALUES ?';
          const imageValues = imageUrls.map(url => [id, url]);

          db.query(imageQuery, [imageValues], (imgErr) => {
            if (imgErr) return db.rollback(() => callback(imgErr));

            // Bước 5: Commit mọi thứ thành công
            db.commit((commitErr) => {
              if (commitErr) return db.rollback(() => callback(commitErr));
              // Trả về kết quả kèm mảng ảnh cũ cần xoá vật lý
              callback(null, { affectedRows: result.affectedRows, oldFilesToDelete });
            });
          });
        });
      });
    });
  });
};

export const removeCascade = (id, callback) => {
  db.beginTransaction((err) => {
    if (err) return callback(err);
    db.query('SELECT image FROM service_images WHERE service_id = ?', [id], (err, imageRows) => {
      if (err) return db.rollback(() => callback(err));
      const fileNamesToDelete = imageRows.map(row => row.image);

      db.query('DELETE FROM service_images WHERE service_id = ?', [id], (err) => {
        if (err) return db.rollback(() => callback(err));

        db.query('SELECT id FROM packages WHERE service_id = ?', [id], (err, packageRows) => {
          if (err) return db.rollback(() => callback(err));
          const packageIds = packageRows.map(row => row.id);

          const deletePackagesAndService = () => {
            db.query('DELETE FROM packages WHERE service_id = ?', [id], (err) => {
              if (err) return db.rollback(() => callback(err));
              db.query('DELETE FROM services WHERE id = ?', [id], (err, result) => {
                if (err) return db.rollback(() => callback(err));
                db.commit((commitErr) => {
                  if (commitErr) return db.rollback(() => callback(commitErr));
                  callback(null, { result, fileNamesToDelete });
                });
              });
            });
          };

          if (packageIds.length > 0) {
            db.query('DELETE FROM user_package WHERE package_id IN (?)', [packageIds], (err) => {
              if (err) return db.rollback(() => callback(err));
              deletePackagesAndService();
            });
          } else {
            deletePackagesAndService();
          }
        });
      });
    });
  });
};