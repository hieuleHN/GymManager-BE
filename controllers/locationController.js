import * as LocationModel from '../models/locationModel.js';
import fs from 'fs';
import path from 'path';

// 💡 CẬP NHẬT: Thêm tham số folderName để tái sử dụng động cho bất kỳ thư mục nào
const deletePhysicalFiles = (fileNames, folderName) => {
  if (!fileNames || fileNames.length === 0) return;
  
  fileNames.forEach(fileName => {
    // Sử dụng process.cwd() để đảm bảo đường dẫn luôn chuẩn xác từ thư mục gốc
    const filePath = path.join(process.cwd(), 'uploads', folderName, fileName);
    
    // Kiểm tra file có tồn tại trên ổ cứng không rồi mới xóa (Dùng unlinkSync cho đồng bộ)
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Đã xóa file rác thành công: ${fileName} tại thư mục ${folderName}`);
      } catch (err) {
        console.error(`Không thể xóa file vật lý: ${filePath}`, err);
      }
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
  const { address, phone, title, description, openTime, closeTime } = req.body;
  
  if (!address) {
    if (req.files) deletePhysicalFiles(req.files.map(f => f.filename), 'locations');
    return res.status(400).json({ error: 'Địa chỉ cơ sở là bắt buộc!' });
  }

  if (!phone) {
    if (req.files) deletePhysicalFiles(req.files.map(f => f.filename), 'locations');
    return res.status(400).json({ error: 'Số điện thoại là bắt buộc!' });
  }

  // Chuẩn hóa description từ req.body thành một mảng phẳng để bốc theo index
  let descArray = [];
  if (req.body.description) {
    descArray = Array.isArray(req.body.description) 
      ? req.body.description 
      : [req.body.description];
  }

  // Tạo mảng Object gom: [ { url: ..., description: ... }, ... ]
  let imagesData = [];
  if (req.files && req.files.length > 0) {
    imagesData = req.files.map((file, index) => ({
      url: file.filename,
      description: descArray[index] || null // Nếu ảnh này không có mô tả tương ứng thì để null
    }));
  }

  // Truyền mảng Object imagesData xuống cho Model xử lý insert
  LocationModel.createWithImages({ address, phone, title, description, openTime, closeTime }, imagesData, (err, result) => {
    if (err) {
      // BẪY LỖI HỆ THỐNG: Nếu lỗi DB, lấy danh sách tên file ra để xóa vật lý, tránh rác ổ cứng
      const fileNamesToXoa = req.files ? req.files.map(f => f.filename) : [];
      deletePhysicalFiles(fileNamesToXoa, 'locations');
      return res.status(500).json({ error: err.message });
    }
    
    res.status(201).json({ 
      message: 'Thêm cơ sở kèm bộ sưu tập ảnh và mô tả thành công!', 
      location_id: result.insertId,
      uploaded_images: imagesData
    });
  });
};

// 2. CHỨC NĂNG CẬP NHẬT (THAY MỚI ALBUM ẢNH + MÔ TẢ)
export const updateLocation = (req, res) => {
  const { address, phone, title, description, openTime, closeTime, bankName, accountNumber, accountName, branch, qrImage } = req.body;
  
  if (!address) {
    if (req.files) deletePhysicalFiles(req.files.map(f => f.filename), 'locations');
    return res.status(400).json({ error: 'Địa chỉ cơ sở là bắt buộc!' });
  }

  if (!phone) {
    if (req.files) deletePhysicalFiles(req.files.map(f => f.filename), 'locations');
    return res.status(400).json({ error: 'Số điện thoại là bắt buộc!' });
  }

  // Chuẩn hóa mảng description tương tự hàm tạo mới
  let descArray = [];
  if (req.body.description) {
    descArray = Array.isArray(req.body.description) 
      ? req.body.description 
      : [req.body.description];
  }

  let imagesData = [];
  if (req.files && req.files.length > 0) {
    imagesData = req.files.map((file, index) => ({
      url: file.filename,
      description: descArray[index] || null
    }));
  }

  // Truyền imagesData xuống Model cập nhật
  LocationModel.updateWithImages(req.params.id, { address, phone, title, description, openTime, closeTime, bankName, accountNumber, accountName, branch, qrImage }, imagesData, (err, result) => {
    if (err) {
      // Nếu lỗi DB, xóa các file ảnh vừa được upload lên tạm
      const fileNamesToXoa = req.files ? req.files.map(f => f.filename) : [];
      deletePhysicalFiles(fileNamesToXoa, 'locations');
      if (err.message === 'NotFound') return res.status(404).json({ error: 'Không tìm thấy cơ sở để cập nhật!' });
      return res.status(500).json({ error: err.message });
    }

    // Nếu cập nhật thành công và trong DB trả về danh sách ảnh cũ đã bị thay thế (oldFiles)
    if (imagesData.length > 0 && result.oldFiles && result.oldFiles.length > 0) {
      deletePhysicalFiles(result.oldFiles, 'locations');
    }

    res.json({ message: 'Cập nhật cơ sở và thay mới album ảnh thành công!' });
  });
};

// Cập nhật thông tin thanh toán
export const updatePaymentInfo = (req, res) => {
  const { bankName, accountNumber, accountName, branch } = req.body;
  LocationModel.updatePaymentInfo(req.params.id, { bankName, accountNumber, accountName, branch }, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Cập nhật thông tin thanh toán thành công!' });
  });
};

// Upload chữ ký đại diện cho cơ sở
export const uploadSignature = (req, res) => {
  const { signature } = req.body;
  if (!signature) {
    return res.status(400).json({ error: 'Vui lòng cung cấp ảnh chữ ký!' });
  }
  LocationModel.updateSignature(req.params.id, signature, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Cập nhật chữ ký thành công!', signature });
  });
};

// Upload mã QR cho cơ sở
export const uploadQR = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Vui lòng chọn file ảnh QR!' });
  }
  const qrImage = req.file.filename;
  LocationModel.updateQR(req.params.id, qrImage, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Cập nhật mã QR thành công!', qrImage });
  });
};

// CẬP NHẬT: Xóa toàn bộ file ảnh vật lý khi xóa cơ sở
export const deleteLocation = (req, res) => {
  LocationModel.remove(req.params.id, (err, result) => {
    if (err) {
      return res.status(500).json({ 
        error: 'Lỗi hệ thống khi xóa dây chuyền cơ sở!', 
        details: err.message 
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy cơ sở để xóa!' });
    }

    // 🎯 1. Dùng chung hàm helper quét rác thư mục ảnh Location
    deletePhysicalFiles(result.locationFiles, 'locations');

    // 🎯 2. Tái sử dụng để quét rác thư mục ảnh Services cực kỳ gọn gàng
    deletePhysicalFiles(result.serviceFiles, 'services');

    res.json({ 
      message: 'Xóa thành công cơ sở và TOÀN BỘ dịch vụ, gói tập, lịch sử hội viên cùng ảnh vật lý liên quan!' 
    });
  });
};