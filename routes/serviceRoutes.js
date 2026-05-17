import express from 'express';
import * as ServiceController from '../controllers/serviceController.js';

const router = express.Router();

router.get('/', ServiceController.getAllServices);
router.get('/:id', ServiceController.getServiceById);
router.post('/', ServiceController.createService);
router.put('/:id', ServiceController.updateService);
router.delete('/:id', ServiceController.deleteService);

export default router;