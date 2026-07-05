import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { create, list, resolve } from '../controllers/communityReportController.js';

const router = express.Router();

router.post('/', authenticateToken, create);
router.get('/', authenticateToken, list);
router.put('/:id/resolve', authenticateToken, resolve);

export default router;
