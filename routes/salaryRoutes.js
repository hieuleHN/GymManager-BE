import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  details, update, pay, history, historyByStaff
} from '../controllers/salaryController.js';

const router = express.Router();

router.get('/details', authenticateToken, details);
router.put('/update', authenticateToken, update);
router.post('/pay', authenticateToken, pay);
router.get('/history', authenticateToken, history);
router.get('/history/:staffId', authenticateToken, historyByStaff);

export default router;