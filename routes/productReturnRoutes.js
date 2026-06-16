import express from 'express';
import * as ProductReturnController from '../controllers/productReturnController.js';

const router = express.Router();

router.get('/', ProductReturnController.list);
router.post('/', ProductReturnController.create);
router.delete('/:id', ProductReturnController.remove);

export default router;