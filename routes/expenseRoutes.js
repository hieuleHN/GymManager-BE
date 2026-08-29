import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { list, summary, detail, create, update, remove } from '../controllers/expenseController.js';

const router = express.Router();

router.get('/', authenticateToken, list);
router.get('/summary', authenticateToken, summary);
router.get('/:id', authenticateToken, detail);
router.post('/', authenticateToken, create);
router.put('/:id', authenticateToken, update);
router.delete('/:id', authenticateToken, remove);

export default router;
