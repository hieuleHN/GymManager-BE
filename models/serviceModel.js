import db from '../config/db.js';

export const getAll = (callback) => {
  const query = `
    SELECT s.*, 
           IF(COUNT(si.id) > 0, 
              CONCAT('[', GROUP_CONCAT(JSON_OBJECT('url', si.image, 'description', si.description)), ']'), 
              '[]') AS images_json
    FROM services s
    LEFT JOIN service_images si ON s.id = si.service_id
    GROUP BY s.id
  `;
  db.query(query, (err, results) => {
    if (err) return callback(err);
    
    // Xử lý chuỗi JSON thành mảng Object [{ url: '...', description: '...' }]
    const formattedResults = results.map(row => {
      const formattedRow = { ...row };
      formattedRow.images = JSON.parse(row.images_json || '[]');
      delete formattedRow.images_json; // Xóa cột tạm
      return formattedRow;
    });
    
    callback(null, formattedResults);
  });
};

export const getById = (id, callback) => {
  const query = `
    SELECT s.*, 
           IF(COUNT(si.id) > 0, 
              CONCAT('[', GROUP_CONCAT(JSON_OBJECT('url', si.image, 'description', si.description)), ']'), 
              '[]') AS images_json
    FROM services s
    LEFT JOIN service_images si ON s.id = si.service_id
    WHERE s.id = ?
    GROUP BY s.id
  `;
  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    if (results.length === 0) return callback(null, []);
    
    const row = results[0];
    row.images = JSON.parse(row.images_json || '[]');
    delete row.images_json;
    
    callback(null, [row]);
  });
};

// Sử dụng mảng imagesData (chứa object) thay cho imageUrls (chỉ chứa string)
export const createWithImages = (data, imagesData, callback) => {
  const { name, location_id } = data;
  db.beginTransaction((err) => {
    if (err) return callback(err);

    db.query('INSERT INTO services (name, location_id) VALUES (?, ?)', [name, location_id], (err, result) => {
      if (err) return db.rollback(() => callback(err));
      const serviceId = result.insertId;

      if (!imagesData || imagesData.length === 0) {
        return db.commit((commitErr) => {
          if (commitErr) return db.rollback(() => callback(commitErr));
          callback(null, result);
        });
      }

      // Chuẩn bị mảng 3 tham số: [service_id, image, description]
      const imageQuery = 'INSERT INTO service_images (service_id, image, description) VALUES ?';
      const imageValues = imagesData.map(img => [serviceId, img.url, img.description || null]);

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

export const updateWithImages = (id, data, imagesData, callback) => {
  const { name, location_id } = data;

  db.beginTransaction((err) => {
    if (err) return callback(err);

    db.query('UPDATE services SET name = ?, location_id = ? WHERE id = ?', [name, location_id, id], (err, result) => {
      if (err) return db.rollback(() => callback(err));
      if (result.affectedRows === 0) return db.rollback(() => callback(new Error('NOT_FOUND')));

      if (!imagesData || imagesData.length === 0) {
        return db.commit((commitErr) => {
          if (commitErr) return db.rollback(() => callback(commitErr));
          callback(null, { affectedRows: result.affectedRows, oldFilesToDelete: [] });
        });
      }

      db.query('SELECT image FROM service_images WHERE service_id = ?', [id], (err, imageRows) => {
        if (err) return db.rollback(() => callback(err));
        const oldFilesToDelete = imageRows.map(row => row.image);

        db.query('DELETE FROM service_images WHERE service_id = ?', [id], (err) => {
          if (err) return db.rollback(() => callback(err));

          // Chèn ảnh và mô tả mới
          const imageQuery = 'INSERT INTO service_images (service_id, image, description) VALUES ?';
          const imageValues = imagesData.map(img => [id, img.url, img.description || null]);

          db.query(imageQuery, [imageValues], (imgErr) => {
            if (imgErr) return db.rollback(() => callback(imgErr));

            db.commit((commitErr) => {
              if (commitErr) return db.rollback(() => callback(commitErr));
              callback(null, { affectedRows: result.affectedRows, oldFilesToDelete });
            });
          });
        });
      });
    });
  });
};

// (Hàm removeCascade giữ nguyên như code của bạn vì nó chỉ xoá và lấy tên file)
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