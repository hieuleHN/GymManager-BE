import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { uploadDynamic } from '../middleware/uploadMiddleware.js';
import {
  register, list, detail, update, remove, approve, reject, pendingList, myInfo, submitInfo
} from '../controllers/customerController.js';
import { login } from '../controllers/customerAuthController.js';

const router = express.Router();
const uploadCustomer = uploadDynamic('customers');

const handleUpload = (req, res, next) => {
  uploadCustomer.fields([
    { name: 'idCardFront', maxCount: 1 },
    { name: 'idCardBack', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

router.post('/register', register);
router.post('/login', login);
router.get('/', authenticateToken, list);
router.get('/pending', authenticateToken, pendingList);
router.get('/my-info', authenticateToken, myInfo);
router.post('/submit-info', authenticateToken, handleUpload, submitInfo);
router.get('/:id', authenticateToken, detail);
router.put('/:id', authenticateToken, handleUpload, update);
router.delete('/:id', authenticateToken, remove);
router.post('/:id/approve', authenticateToken, approve);
router.post('/:id/reject', authenticateToken, reject);

export default router;
