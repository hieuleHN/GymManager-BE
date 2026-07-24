import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { generateQR, verifyQR, todayAttendance, attendanceHistory } from '../controllers/staffAttendanceController.js';

const router = express.Router();

router.get('/qr', authenticateToken, generateQR);
router.post('/verify', verifyQR);
router.get('/today', authenticateToken, todayAttendance);
router.get('/history', authenticateToken, attendanceHistory);

export default router;
