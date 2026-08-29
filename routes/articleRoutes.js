import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { uploadDynamic } from '../middleware/uploadMiddleware.js';
import {
  list,
  detail,
  recordView,
  related,
  create,
  update,
  publish,
  unpublish,
  remove
} from '../controllers/articleController.js';

const router = express.Router();
const uploadImage = uploadDynamic('articles');

router.get('/', list);
router.get('/:id/related', related);
router.get('/:id', detail);
router.post('/:id/view', recordView);

router.post('/', authenticateToken, uploadImage.single('image'), create);
router.put('/:id', authenticateToken, uploadImage.single('image'), update);
router.put('/:id/publish', authenticateToken, publish);
router.put('/:id/unpublish', authenticateToken, unpublish);
router.delete('/:id', authenticateToken, remove);

export default router;
