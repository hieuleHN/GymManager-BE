import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { create, listByTarget, list, resolve } from '../controllers/reportController.js';

const router = express.Router();

router.post('/', authenticateToken, create);
router.get('/', authenticateToken, list);
router.get('/target/:targetId', authenticateToken, listByTarget);
router.put('/:id/resolve', authenticateToken, resolve);

export default router;
