import express from 'express';
import multer from 'multer';
import path from 'path';
import * as ProductController from '../controllers/productController.js';

const router = express.Router();

// --- Cấu hình nơi lưu trữ file ảnh tải lên ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Ảnh tải lên từ giao diện sẽ nhảy vào thư mục này
  },
  filename: (req, file, cb) => {
    // Đổi tên file thành: ngày_giờ_tên_gốc để không bao giờ bị trùng lặp file
    cb(null, Date.now() + path.extname(file.originalname)); 
  }
});

const upload = multer({ storage: storage });
// --------------------------------------------

// 1. Lấy tất cả sản phẩm
router.get('/', ProductController.getAllProducts);

// 2. Lấy sản phẩm theo cơ sở (location)
router.get('/location/:locationId', ProductController.getProductsByLocation);

// 3. Lấy sản phẩm theo ID
router.get('/:id', ProductController.getProductById);

// 4. Thêm sản phẩm (🌟 SỬA DÒNG NÀY: Thêm upload.single('image') để bắt file ảnh thật)
router.post('/', upload.single('image'), ProductController.createProduct);

// 5. Cập nhật sản phẩm
router.put('/:id', ProductController.updateProduct);

// 6. Xóa sản phẩm
router.delete('/:id', ProductController.deleteProduct);

// 7. Báo cáo sản phẩm
router.post('/:id/report', ProductController.addReport);

// 8. Giải quyết báo cáo
router.put('/:id/report/:reportId/resolve', ProductController.resolveReport);

export default router;