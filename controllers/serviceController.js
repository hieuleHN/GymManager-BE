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
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }
  const { name, location_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên dịch vụ là bắt buộc!' });
  if (!location_id) return res.status(400).json({ error: 'ID địa điểm là bắt buộc!' });

  // 1. Chuẩn hóa mảng mô tả
  let descArray = [];
  const rawDescriptions = req.body.descriptions || req.body.description;
  if (rawDescriptions) {
    descArray = Array.isArray(rawDescriptions) ? rawDescriptions : [rawDescriptions];
  }

  // 2. Gom URL ảnh và mô tả thành mảng Object
  let imagesData = [];
  if (req.files && req.files.length > 0) {
    imagesData = req.files.map((file, index) => ({
      url: file.filename,
      description: descArray[index] || null
    }));
  }

  ServiceModel.createWithImages({ name, location_id }, imagesData, (err, result) => {
    if (err) {
      // Lấy danh sách tên file để xoá nếu lỗi DB
      const fileNamesToXoa = req.files ? req.files.map(f => f.filename) : [];
      deletePhysicalFiles(fileNamesToXoa);
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ 
      message: 'Thêm dịch vụ kèm ảnh thành công!', 
      service_id: result.insertId,
      images: imagesData
    });
  });
};

export const updateService = (req, res) => {
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }
  const { name, location_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên dịch vụ là bắt buộc!' });
  if (!location_id) return res.status(400).json({ error: 'ID địa điểm là bắt buộc!' });

  const id = req.params.id;

  // 1. Chuẩn hóa mảng mô tả
  let descArray = [];
  const rawDescriptions = req.body.descriptions || req.body.description;
  if (rawDescriptions) {
    descArray = Array.isArray(rawDescriptions) ? rawDescriptions : [rawDescriptions];
  }

  // 2. Gom dữ liệu ảnh và mô tả
  let newImagesData = [];
  if (req.files && req.files.length > 0) {
    newImagesData = req.files.map((file, index) => ({
      url: file.filename,
      description: descArray[index] || null
    }));
  }

  ServiceModel.updateWithImages(id, { name, location_id }, newImagesData, (err, data) => {
    if (err) {
      // Nếu lỗi thì xoá file tạm vừa up lên
      const fileNamesToXoa = req.files ? req.files.map(f => f.filename) : [];
      deletePhysicalFiles(fileNamesToXoa);
      
      if (err.message === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Không tìm thấy dịch vụ để cập nhật!' });
      }
      return res.status(500).json({ error: 'Lỗi hệ thống khi cập nhật dịch vụ!', details: err.message });
    }

    // Nếu thay ảnh thành công, xoá ảnh cũ
    if (data.oldFilesToDelete && data.oldFilesToDelete.length > 0) {
      deletePhysicalFiles(data.oldFilesToDelete);
    }

    res.json({ 
      message: 'Cập nhật dịch vụ thành công!',
      updated_images: newImagesData.length > 0 ? newImagesData : 'Giữ nguyên ảnh cũ'
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