import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { generateQR, verifyQR, todayAttendance, attendanceHistory, attendanceStats, attendanceAbsences } from '../controllers/staffAttendanceController.js';

const router = express.Router();

router.get('/qr', authenticateToken, generateQR);
router.post('/verify', authenticateToken, verifyQR);
router.get('/today', authenticateToken, todayAttendance);
router.get('/history', authenticateToken, attendanceHistory);
router.get('/stats', authenticateToken, attendanceStats);
router.get('/absences', authenticateToken, attendanceAbsences);

export default router;
