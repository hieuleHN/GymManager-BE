import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { list, detail, create, update, resolve, remove } from '../controllers/lockerController.js';

const router = express.Router();

router.get('/', authenticateToken, list);
router.get('/:id', authenticateToken, detail);
router.post('/', authenticateToken, create);
router.put('/:id', authenticateToken, update);
router.patch('/:id/resolve', authenticateToken, resolve);
router.delete('/:id', authenticateToken, remove);

export default router;