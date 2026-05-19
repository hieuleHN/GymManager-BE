import express from 'express';
import * as LocationController from '../controllers/locationController.js';
import { uploadDynamic } from '../middleware/uploadMiddleware.js'; // Import hàm bọc

const router = express.Router();

router.get('/', LocationController.getAllLocations);
router.get('/:id', LocationController.getLocationById);

// Truyền tham số 'locations' -> Ảnh tự động lưu vào 'uploads/locations/'
router.post('/', uploadDynamic('locations').array('images', 10), LocationController.createLocation);
router.put('/:id', uploadDynamic('locations').array('images', 10), LocationController.updateLocation);

router.delete('/:id', LocationController.deleteLocation);

export default router;