import express from 'express';
import * as EquipmentController from '../controllers/equipmentController.js';

const router = express.Router();

// Lấy tất cả thiết bị
router.get('/', EquipmentController.getAllEquipments);

// Lấy thiết bị theo cơ sở (location)
router.get('/location/:locationId', EquipmentController.getEquipmentsByLocation);

// Lấy thiết bị theo ID
router.get('/:id', EquipmentController.getEquipmentById);

// Thêm thiết bị
router.post('/', EquipmentController.createEquipment);

// Cập nhật thiết bị
router.put('/:id', EquipmentController.updateEquipment);

// Xóa thiết bị
router.delete('/:id', EquipmentController.deleteEquipment);

export default router;