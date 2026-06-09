import express from 'express';
import * as ServiceController from '../controllers/serviceController.js';
import { uploadDynamic } from '../middleware/uploadMiddleware.js'; // Gọi hàm wrapper dynamic dùng chung

const router = express.Router();

// Khởi tạo middleware chuyên biệt cho thư mục 'uploads/services/'
const upload = uploadDynamic('services');

// Các Router lấy dữ liệu
router.get('/', ServiceController.getAllServices);
router.get('/:id', ServiceController.getServiceById);

// Thêm dịch vụ (Nhận tối đa 10 ảnh thông qua trường dữ liệu tên là 'images')
router.post('/', upload.array('images', 10), ServiceController.createService);

// Cập nhật dịch vụ (Cho phép cập nhật thông tin và ghi đè tối đa 10 ảnh mới)
router.put('/:id', upload.array('images', 10), ServiceController.updateService);

// Xoá dây chuyền dịch vụ
router.delete('/:id', ServiceController.deleteService);

export default router;