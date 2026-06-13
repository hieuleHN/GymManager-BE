import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  list, detail, create, update, remove
} from '../controllers/jobController.js';

const router = express.Router();

router.get('/', authenticateToken, list);
router.get('/:id', authenticateToken, detail);
router.post('/', authenticateToken, create);
router.put('/:id', authenticateToken, update);
router.delete('/:id', authenticateToken, remove);

export default router;