import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import {
  monitorConversations,
  monitorTranscript,
  resolveFlag,
  deleteMessage,
  monitorStats
} from '../controllers/messageMonitorController.js';

const router = express.Router();

router.get('/conversations', authenticateToken, requireAdmin, monitorConversations);
router.get('/transcript', authenticateToken, requireAdmin, monitorTranscript);
router.get('/stats', authenticateToken, requireAdmin, monitorStats);
router.post('/resolve', authenticateToken, requireAdmin, resolveFlag);
router.delete('/messages/:messageId', authenticateToken, requireAdmin, deleteMessage);

export default router;
