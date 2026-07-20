import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { create, listByDate, listByDateRange, listByStaff, remove, bulkCreate } from '../controllers/staffShiftController.js';

const router = express.Router();

router.get('/by-date', authenticateToken, listByDate);
router.get('/by-range', authenticateToken, listByDateRange);
router.get('/by-staff', authenticateToken, listByStaff);
router.post('/', authenticateToken, create);
router.post('/bulk', authenticateToken, bulkCreate);
router.delete('/:id', authenticateToken, remove);

export default router;
