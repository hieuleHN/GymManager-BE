import multer from 'multer';
import path from 'path';
import fs from 'fs';

const fileFilter = (req, file, cb) => {
  const allowed = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'text/plain'];
  const ok = allowed.some((prefix) => file.mimetype.startsWith(prefix) || file.mimetype === prefix);
  if (ok) {
    cb(null, true);
  } else {
    req.fileValidationError = 'Định dạng file không được hỗ trợ!';
    cb(null, false);
  }
};

export const uploadChatFile = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const destPath = 'uploads/chat/';
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      cb(null, destPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
});
