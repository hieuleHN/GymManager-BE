import express from 'express';
import * as EquipmentController from '../controllers/equipmentController.js';

const router = express.Router();

router.get('/', EquipmentController.getAllEquipments);
router.get('/location/:locationId', EquipmentController.getEquipmentsByLocation);
router.get('/:id', EquipmentController.getEquipmentById);
router.post('/', EquipmentController.createEquipment);
router.put('/:id', EquipmentController.updateEquipment);
router.delete('/:id', EquipmentController.deleteEquipment);
router.post('/:id/report', EquipmentController.reportEquipment);
router.put('/:id/report/:reportId/resolve', EquipmentController.resolveReport);

export default router;
