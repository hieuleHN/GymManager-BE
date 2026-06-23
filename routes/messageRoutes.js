import express from 'express';
import { getHistory, markRead, getUnread, getContacts } from '../controllers/messageController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/contacts', getContacts);
router.get('/history/:contactId', getHistory);
router.post('/mark-read', markRead);
router.get('/unread', getUnread);

export default router;
