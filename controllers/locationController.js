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

// CẬP NHẬT: Xóa ảnh cũ khi cập nhật bộ ảnh mới
export const updateLocation = (req, res) => {
  const { address, phone } = req.body;
  if (!address) {
    // Nếu lỗi validate, xóa ngay các file vừa được multer tải lên tạm thời
    if (req.files) deletePhysicalFiles(req.files.map(f => f.filename));
    return res.status(400).json({ error: 'Địa chỉ cơ sở là bắt buộc!' });
  }

  let imageUrls = [];
  if (req.files && req.files.length > 0) {
    imageUrls = req.files.map(file => file.filename);
  }

  LocationModel.updateWithImages(req.params.id, { address, phone }, imageUrls, (err, result) => {
    if (err) {
      // Nếu DB lỗi, xóa các file ảnh vừa được up lên
      deletePhysicalFiles(imageUrls);
      if (err.message === 'NotFound') return res.status(404).json({ error: 'Không tìm thấy cơ sở để cập nhật!' });
      return res.status(500).json({ error: err.message });
    }

    // Nếu cập nhật thành công và có upload bộ ảnh mới -> Tiến hành xóa bộ ảnh cũ khỏi ổ cứng
    if (imageUrls.length > 0 && result.oldFiles && result.oldFiles.length > 0) {
      deletePhysicalFiles(result.oldFiles);
    }

    res.json({ message: 'Cập nhật cơ sở và thay mới album ảnh thành công!' });
  });
};

// CẬP NHẬT: Xóa toàn bộ file ảnh vật lý khi xóa cơ sở
export const deleteLocation = (req, res) => {
  LocationModel.remove(req.params.id, (err, result) => {
    if (err) return res.status(500).json({ error: 'Lỗi hệ thống khi xóa cơ sở: ' + err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy cơ sở để xóa!' });
    
    // Gọi hàm xóa sạch các file ảnh vật lý của cơ sở này trên ổ cứng server
    if (result.oldFiles && result.oldFiles.length > 0) {
      deletePhysicalFiles(result.oldFiles);
    }

    res.json({ message: 'Xóa cơ sở và toàn bộ file ảnh trên server thành công!' });
  });
};