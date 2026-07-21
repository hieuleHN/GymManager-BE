import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  create,
  list,
  markRead,
  markAllRead,
  unreadCount,
  remove
} from '../controllers/notificationController.js';

const router = express.Router();

router.post('/', authenticateToken, create);
router.get('/', authenticateToken, list);
router.get('/unread-count', authenticateToken, unreadCount);
router.put('/:id/read', authenticateToken, markRead);
router.put('/read-all', authenticateToken, markAllRead);
router.delete('/:id', authenticateToken, remove);

export default router;
