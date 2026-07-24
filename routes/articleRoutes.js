import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import { uploadDynamic } from '../middleware/uploadMiddleware.js';
import {
  create, list, detail, update, remove, view, related, publish, unpublish
} from '../controllers/articleController.js';

const router = express.Router();
const uploadArticle = uploadDynamic('articles');

router.get('/', list);
router.get('/:id', detail);
router.get('/:id/related', related);
router.post('/:id/view', view);

router.post('/', authenticateToken, uploadArticle.single('image'), create);
router.put('/:id', authenticateToken, uploadArticle.single('image'), update);
router.delete('/:id', authenticateToken, remove);
router.put('/:id/publish', authenticateToken, publish);
router.put('/:id/unpublish', authenticateToken, unpublish);
router.post('/upload-image', authenticateToken, uploadArticle.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file!' });
  res.json({ url: `/uploads/articles/${req.file.filename}` });
});

export default router;
