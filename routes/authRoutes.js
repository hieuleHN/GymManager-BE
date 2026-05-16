import express from 'express';
import { register, login } from '../controllers/authController.js';

const router = express.Router();

// Đường dẫn thực tế khi gọi từ FE: http://localhost:5000/auth/register
router.post('/register', register);

// Đường dẫn thực tế khi gọi từ FE: http://localhost:5000/auth/login
router.post('/login', login);

export default router;