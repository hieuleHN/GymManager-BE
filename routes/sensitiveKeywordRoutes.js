import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import {
  getKeywords,
  createKeyword,
  editKeyword,
  removeKeyword
} from '../controllers/sensitiveKeywordController.js';

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, getKeywords);
router.post('/', authenticateToken, requireAdmin, createKeyword);
router.put('/:id', authenticateToken, requireAdmin, editKeyword);
router.delete('/:id', authenticateToken, requireAdmin, removeKeyword);

export default router;
