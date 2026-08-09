import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { uploadChatFile } from '../middleware/chatUploadMiddleware.js';
import { contacts, unread, history, supportHistory, markRead, markSupportRead, send, sendSupport, recall, pin, reminder, uploadAttachment } from '../controllers/messageController.js';

const router = express.Router();

router.get('/contacts', authenticateToken, contacts);
router.get('/unread', authenticateToken, unread);
router.get('/history/:contactId', authenticateToken, history);
router.get('/support/history/:contactId', authenticateToken, supportHistory);
router.post('/mark-read', authenticateToken, markRead);
router.post('/support/mark-read', authenticateToken, markSupportRead);
router.post('/send', authenticateToken, send);
router.post('/support/send', authenticateToken, sendSupport);
router.post('/recall', authenticateToken, recall);
router.post('/pin', authenticateToken, pin);
router.post('/reminder', authenticateToken, reminder);
router.post('/upload', authenticateToken, uploadChatFile.array('files', 10), uploadAttachment);

export default router;
