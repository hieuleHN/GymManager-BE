import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  list, detail, create, update, remove, login, listTrainers, registerFace, removeFace, faceDescriptors, verifyFaceAttendance
} from '../controllers/staffController.js';

const router = express.Router();

router.post('/login', login);
router.get('/face/descriptors', authenticateToken, faceDescriptors);
router.post('/face/verify', authenticateToken, verifyFaceAttendance);
router.get('/trainers', authenticateToken, listTrainers);
router.get('/', authenticateToken, list);
router.post('/', authenticateToken, create);
router.get('/:id', authenticateToken, detail);
router.put('/:id', authenticateToken, update);
router.delete('/:id', authenticateToken, remove);
router.post('/:id/face/register', authenticateToken, registerFace);
router.delete('/:id/face', authenticateToken, removeFace);

export default router;
