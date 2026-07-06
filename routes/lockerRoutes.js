import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import { list, detail, create, update, resolve, reject, remove } from '../controllers/lockerController.js';

const router = express.Router();

// HLV: tạo báo cáo và xem báo cáo (chỉ thấy của mình, xem lockerController.list/detail)
router.get('/', authenticateToken, list);
router.get('/:id', authenticateToken, detail);
router.post('/', authenticateToken, create);

// Admin: các hành động duyệt/xử lý/từ chối/sửa/xóa
router.put('/:id', authenticateToken, requireAdmin, update);
router.patch('/:id/resolve', authenticateToken, requireAdmin, resolve);
router.patch('/:id/reject', authenticateToken, requireAdmin, reject);
router.delete('/:id', authenticateToken, requireAdmin, remove);

export default router;