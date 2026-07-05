import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { uploadDynamic } from '../middleware/uploadMiddleware.js';
import {
  create, list, detail, update, remove, like, share, view, listByAuthor, hide, unhide
} from '../controllers/communityPostController.js';

const router = express.Router();
const uploadCommunity = uploadDynamic('community');

router.get('/', list);
router.get('/author/:authorId/:authorModel', listByAuthor);
router.get('/:id', detail);
router.post('/', authenticateToken, uploadCommunity.array('images', 10), create);
router.put('/:id', authenticateToken, update);
router.delete('/:id', authenticateToken, remove);
router.post('/:id/like', authenticateToken, like);
router.post('/:id/share', authenticateToken, share);
router.post('/:id/view', view);
router.put('/:id/hide', authenticateToken, hide);
router.put('/:id/unhide', authenticateToken, unhide);

export default router;
