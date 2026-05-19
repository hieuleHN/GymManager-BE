import * as ServiceModel from '../models/serviceModel.js';
import fs from 'fs';
import path from 'path';

const deletePhysicalFiles = (fileNames) => {
  if (!fileNames || fileNames.length === 0) return;
  fileNames.forEach(fileName => {
    const filePath = path.join(process.cwd(), 'uploads', 'services', fileName);
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (!err) {
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) console.error(`Không thể xóa file: ${filePath}`, unlinkErr);
        });
      }
    });
  });
};

export const getAllServices = (req, res) => {
  ServiceModel.getAll((err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

export const getServiceById = (req, res) => {
  ServiceModel.getById(req.params.id, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy dịch vụ này!' });
    res.json(results[0]);
  });
};

export const createService = (req, res) => {
  // 🎯 KIỂM TRA LỖI ĐỊNH DẠNG ẢNH NGAY TẠI ĐÂY (Giống hệt logic Auth)
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên dịch vụ là bắt buộc!' });

  let imageUrls = [];
  if (req.files && req.files.length > 0) {
    imageUrls = req.files.map(file => file.filename);
  }

  ServiceModel.createWithImages({ name, description }, imageUrls, (err, result) => {
    if (err) {
      deletePhysicalFiles(imageUrls);
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ 
      message: 'Thêm dịch vụ thành công!', 
      service_id: result.insertId,
      images: imageUrls
    });
  });
};

// --- HÀM CẬP NHẬT ĐƯỢC ĐỔI MỚI Ở ĐÂY ---
export const updateService = (req, res) => {
  // 🎯 KIỂM TRA LỖI ĐỊNH DẠNG ẢNH NGAY TẠI ĐÂY (Giống hệt logic Auth)
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên dịch vụ là bắt buộc!' });

  const id = req.params.id;

  // Thu thập mảng ảnh mới (nếu có) do Multer xử lý
  let newImageUrls = [];
  if (req.files && req.files.length > 0) {
    newImageUrls = req.files.map(file => file.filename);
  }

  ServiceModel.updateWithImages(id, { name, description }, newImageUrls, (err, data) => {
    if (err) {
      // Nếu lưu DB thất bại, xoá luôn các file mới vừa được upload lên để tránh rác
      deletePhysicalFiles(newImageUrls);
      
      if (err.message === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Không tìm thấy dịch vụ để cập nhật!' });
      }
      return res.status(500).json({ error: 'Lỗi hệ thống khi cập nhật dịch vụ!', details: err.message });
    }

    // Nếu cập nhật DB thành công và thực sự có ảnh mới thay thế ảnh cũ
    if (data.oldFilesToDelete && data.oldFilesToDelete.length > 0) {
      deletePhysicalFiles(data.oldFilesToDelete);
    }

    res.json({ 
      message: 'Cập nhật dịch vụ thành công!',
      updated_images: newImageUrls.length > 0 ? newImageUrls : 'Giữ nguyên ảnh cũ'
    });
  });
};

export const deleteService = (req, res) => {
  ServiceModel.removeCascade(req.params.id, (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Lỗi hệ thống khi thực hiện xoá dây chuyền!', details: err.message });
    }
    if (data.result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy dịch vụ để xóa!' });
    }
    deletePhysicalFiles(data.fileNamesToDelete);
    res.json({ 
      message: 'Xóa dịch vụ, toàn bộ ảnh, các gói tập và dữ liệu hội viên đăng ký liên quan thành công!' 
    });
  });
};