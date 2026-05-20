import express from 'express';
import { getAvailablePackagesForUser, buyPackage } from '../controllers/userPackageController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Luồng bước 1: Hiển thị danh sách dịch vụ và các gói tập tương ứng của cơ sở user đó
router.get('/packages/available', authenticateToken, getAvailablePackagesForUser);

// Luồng bước 2: Chọn gói đó xong gửi request chuyển tiền/thêm vào database
router.post('/packages/subscribe', authenticateToken, buyPackage);


export default router;