import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { getHomepage, updateHomepage } from '../controllers/siteSettingController.js';

const router = express.Router();

router.get('/homepage', getHomepage);
router.put('/homepage', authenticateToken, updateHomepage);

export default router;
