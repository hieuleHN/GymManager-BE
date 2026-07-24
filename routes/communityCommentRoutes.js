import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { create, list, remove } from '../controllers/communityCommentController.js';

const router = express.Router();

router.get('/post/:postId', list);
router.post('/post/:postId', authenticateToken, create);
router.delete('/:id', authenticateToken, remove);

export default router;
