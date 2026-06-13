import multer from 'multer';
import path from 'path';
import fs from 'fs';

// 1. Giới hạn định dạng file (dùng chung)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    req.fileValidationError = 'Định dạng file không hợp lệ, chỉ chấp nhận file ảnh!';
    cb(null, false);
  }
};

// 2. HÀM WRAPPER: Nhận vào tên thư mục và trả về cấu hình Multer tương ứng
export const uploadDynamic = (folderName) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Nối chuỗi để tạo đường dẫn động: 'uploads/locations/', 'uploads/users/', v.v.
      const destPath = `uploads/${folderName}/`;

      // 💡 BƯỚC QUAN TRỌNG: Tự động tạo thư mục nếu nó chưa tồn tại trên ổ cứng
      // Tránh lỗi "ENOENT: no such file or directory" khi bạn thêm 1 module mới
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }

      cb(null, destPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  // Trả về middleware multer đã được cấu hình với thư mục động
  return multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // Giới hạn tối đa 5MB
  });
};