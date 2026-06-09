import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { uploadDynamic } from '../middleware/uploadMiddleware.js'; // 💡 Gọi hàm wrapper
import { 
  register, 
  login,
  listUsers, 
  deleteUser, 
  getUserDetail,
  updateUser    
} from '../controllers/authController.js';

const router = express.Router();
const uploadUser = uploadDynamic('users'); // Sinh ra middleware cho thư mục 'uploads/users/'

// 💡 Helper bắt lỗi multer (Nếu sai định dạng ảnh)
const handleAvatarUpload = (req, res, next) => {
  uploadUser.single('avatar')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

// Route công khai
router.post('/register', register);
router.post('/login', login);

// Các Route bảo mật
router.get('/users', authenticateToken, listUsers);
router.get('/users/:id', authenticateToken, getUserDetail);

// 💡 Cập nhật: Thêm middleware bẫy upload ảnh vào trước updateUser
router.put('/users/:id', authenticateToken, handleAvatarUpload, updateUser);

router.delete('/users/:id', authenticateToken, deleteUser);

export default router;