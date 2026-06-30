import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { create, listByTrainer, stats, listByCustomer } from '../controllers/reviewController.js';

const router = express.Router();

router.post('/', authenticateToken, create);
router.get('/trainer/:trainerId', listByTrainer);
router.get('/trainer/:trainerId/stats', stats);
router.get('/customer/:customerId', listByCustomer);

export default router;
