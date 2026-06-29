import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  list, detail, create, update, remove, login, listTrainers
} from '../controllers/staffController.js';

const router = express.Router();

router.post('/login', login);
router.get('/trainers', authenticateToken, listTrainers);
router.get('/', authenticateToken, list);
router.post('/', authenticateToken, create);
router.get('/:id', authenticateToken, detail);
router.put('/:id', authenticateToken, update);
router.delete('/:id', authenticateToken, remove);

export default router;