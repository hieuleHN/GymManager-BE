import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { list, publicList, detail, create, update, remove } from '../controllers/policyController.js';

const router = express.Router();

router.get('/public', publicList);
router.get('/', authenticateToken, list);
router.get('/:id', authenticateToken, detail);
router.post('/', authenticateToken, create);
router.put('/:id', authenticateToken, update);
router.delete('/:id', authenticateToken, remove);

export default router;