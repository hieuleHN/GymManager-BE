import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  list, listFeatures, getByJob, update, remove
} from '../controllers/permissionController.js';

const router = express.Router();

router.get('/', authenticateToken, list);
router.get('/features', authenticateToken, listFeatures);
router.get('/:jobId', authenticateToken, getByJob);
router.put('/', authenticateToken, update);
router.delete('/:jobId', authenticateToken, remove);

export default router;