import db from '../config/db.js';

// 1. Lấy tất cả cơ sở (Gom cụm danh sách ảnh thành một mảng chuỗi)
export const getAll = (callback) => {
  const sql = `
    SELECT l.*, GROUP_CONCAT(li.image) AS images
    FROM location l
    LEFT JOIN location_images li ON l.id = li.location_id
    GROUP BY l.id
  `;
  db.query(sql, (err, results) => {
    if (err) return callback(err);
    // Biến chuỗi "anh1.jpg,anh2.jpg" thành mảng ['anh1.jpg', 'anh2.jpg']
    const formattedResults = results.map(row => ({
      ...row,
      images: row.images ? row.images.split(',') : []
    }));
    callback(null, formattedResults);
  });
};

// 2. Lấy chi tiết một cơ sở kèm mảng ảnh
export const getById = (id, callback) => {
  const sql = `
    SELECT l.*, GROUP_CONCAT(li.image) AS images
    FROM location l
    LEFT JOIN location_images li ON l.id = li.location_id
    WHERE l.id = ?
    GROUP BY l.id
  `;
  db.query(sql, [id], (err, results) => {
    if (err) return callback(err);
    if (results.length === 0) return callback(null, []);
    
    const row = results[0];
    row.images = row.images ? row.images.split(',') : [];
    callback(null, [row]);
  });
};

// 3. Tạo cơ sở mới ĐỒNG THỜI lưu một loạt ảnh (Dùng Transaction)
export const createWithImages = (locationData, imageUrls, callback) => {
  const { address, phone } = locationData;

  db.beginTransaction((err) => {
    if (err) return callback(err);

    // Bước A: Chèn thông tin cơ sở
    db.query('INSERT INTO location (address, phone) VALUES (?, ?)', [address, phone], (err, result) => {
      if (err) return db.rollback(() => callback(err));

      const locationId = result.insertId;

      // Nếu người dùng không upload ảnh nào, commit luôn thông tin cơ bản
      if (!imageUrls || imageUrls.length === 0) {
        return db.commit((err) => {
          if (err) return db.rollback(() => callback(err));
          callback(null, { insertId: locationId });
        });
      }

      // Bước B: Chuẩn bị mảng dữ liệu dạng [[location_id, url1], [location_id, url2]] để insert hàng loạt
      const imageRecords = imageUrls.map(url => [locationId, url]);
      const sqlImages = 'INSERT INTO location_images (location_id, image) VALUES ?';

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

// 4. Cập nhật cơ sở và thay mới bộ ảnh (Xóa ảnh cũ, lưu loạt ảnh mới)
import * as LocationModel from '../models/locationModel.js';
import fs from 'fs';
import path from 'path';

// Hàm helper dùng chung để xóa file vật lý trên ổ cứng tránh lặp code
const deletePhysicalFiles = (fileNames) => {
  if (!fileNames || fileNames.length === 0) return;
  
  fileNames.forEach(fileName => {
    // Đường dẫn chính xác tới file cần xóa
    const filePath = path.join('uploads/locations/', fileName);
    
    // Kiểm tra file có tồn tại trên ổ cứng không rồi mới xóa
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.error(`Không thể xóa file vật lý: ${filePath}`, err);
        else console.log(` Đã xóa file rác thành công: ${fileName}`);
      });
    }
  });
};

export const getAllLocations = (req, res) => {
  LocationModel.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

export const getLocationById = (req, res) => {
  LocationModel.getById(req.params.id, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy cơ sở này!' });
    res.json(results[0]);
  });
};

export const createLocation = (req, res) => {
  const { address, phone } = req.body;
  if (!address) return res.status(400).json({ error: 'Địa chỉ cơ sở là bắt buộc!' });

  let imageUrls = [];
  if (req.files && req.files.length > 0) {
    imageUrls = req.files.map(file => file.filename);
  }

  LocationModel.createWithImages({ address, phone }, imageUrls, (err, result) => {
    if (err) {
      // BẪY LỖI HỆ THỐNG: Nếu lưu DB lỗi thì phải xóa các ảnh vừa upload lên để tránh sinh rác
      deletePhysicalFiles(imageUrls);
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ 
      message: 'Thêm cơ sở kèm bộ sưu tập ảnh thành công!', 
      location_id: result.insertId,
      uploaded_images: imageUrls
    });
  });
};

export const updateWithImages = (id, locationData, imageUrls, callback) => {
  const { address, phone } = locationData;

  db.beginTransaction((err) => {
    if (err) return callback(err);

    // Bước A: Lấy danh sách ảnh cũ TRƯỚC KHI XÓA trong DB để tí nữa dọn ổ cứng
    db.query('SELECT image FROM location_images WHERE location_id = ?', [id], (err, oldImages) => {
      if (err) return db.rollback(() => callback(err));

      const oldImageFiles = oldImages.map(img => img.image);

      // Bước B: Cập nhật thông tin text của cơ sở
      db.query('UPDATE location SET address = ?, phone = ? WHERE id = ?', [address, phone, id], (err, result) => {
        if (err) return db.rollback(() => callback(err));
        if (result.affectedRows === 0) return db.rollback(() => callback(new Error('NotFound')));

        // Bước C: Nếu có ảnh mới, tiến hành xóa ảnh cũ trong DB và chèn ảnh mới
        if (imageUrls && imageUrls.length > 0) {
          db.query('DELETE FROM location_images WHERE location_id = ?', [id], (err) => {
            if (err) return db.rollback(() => callback(err));

            const imageRecords = imageUrls.map(url => [id, url]);
            const sqlImages = 'INSERT INTO location_images (location_id, image) VALUES ?';

            db.query(sqlImages, [imageRecords], (err) => {
              if (err) return db.rollback(() => callback(err));

              db.commit((err) => {
                if (err) return db.rollback(() => callback(err));
                // Trả về kết quả kèm mảng ảnh cũ cần xóa vật lý
                callback(null, { affectedRows: result.affectedRows, oldFiles: oldImageFiles });
              });
            });
          });
        } else {
          // Nếu không có ảnh mới, giữ nguyên ảnh cũ
          db.commit((err) => {
            if (err) return db.rollback(() => callback(err));
            callback(null, { affectedRows: result.affectedRows, oldFiles: [] });
          });
        }
      });
    });
  });
};

export const remove = (id, callback) => {
  // Lấy danh sách ảnh trước để chuẩn bị xóa file vật lý
  db.query('SELECT image FROM location_images WHERE location_id = ?', [id], (err, oldImages) => {
    if (err) return callback(err);
    
    const oldImageFiles = oldImages.map(img => img.image);

    // Tiến hành xóa dữ liệu liên kết ở bảng ảnh trong DB
    db.query('DELETE FROM location_images WHERE location_id = ?', [id], (err) => {
      if (err) return callback(err);

      // Xóa cơ sở ở bảng location
      db.query('DELETE FROM location WHERE id = ?', [id], (err, result) => {
        if (err) return callback(err);
        
        // Trả về danh sách file ảnh cũ cho Controller xử lý xóa vật lý
        callback(null, { affectedRows: result.affectedRows, oldFiles: oldImageFiles });
      });
    });
  });
};