import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  registerPackage, listMyPackages, getRegistrationDetail, cancelRegistration
} from '../controllers/userPackageController.js';

const router = express.Router();

router.post('/register', authenticateToken, registerPackage);
router.get('/my', authenticateToken, listMyPackages);
router.get('/:id', authenticateToken, getRegistrationDetail);
router.post('/:id/cancel', authenticateToken, cancelRegistration);

export default router;
