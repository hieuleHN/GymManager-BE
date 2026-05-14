import express from 'express';
import { getClasses } from '../controllers/classController.js';

const router = express.Router();

router.get('/', getClasses); // tất cả
// router.get('/:id', getClassById);         // chi tiết theo id
// router.get('/limit/:count', getClassesLimit); // giới hạn số lượng
export default router;
