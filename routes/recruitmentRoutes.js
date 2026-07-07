import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  applyJob,
  getAllRecruitments,
  updateStatus,
} from "../controllers/recruitmentController.js";

const router = express.Router();

// Tạo thư mục uploads/cvs nếu chưa tồn tại
const cvsDir = "uploads/cvs";
if (!fs.existsSync(cvsDir)) {
  fs.mkdirSync(cvsDir, { recursive: true });
}

// Cấu hình Multer để lưu file CV
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, cvsDir);
  },
  filename: function (req, file, cb) {
    cb(
      null,
      Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        path.extname(file.originalname),
    );
  },
});

// Chỉ cho phép file PDF hoặc Word
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "application/pdf" ||
    file.mimetype === "application/msword" ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ chấp nhận file PDF hoặc Word (.doc, .docx)"), false);
  }
};

// Cấu hình Multer + Thêm Validation dung lượng file tối đa 5MB
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Khai báo các Endpoint
router.post("/apply", upload.single("cv"), applyJob);
router.get("/", getAllRecruitments);
router.patch("/:id/status", updateStatus);

export default router;
