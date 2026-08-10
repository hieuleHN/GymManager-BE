import express from 'express';
import * as LocationController from '../controllers/locationController.js';
import { uploadDynamic } from '../middleware/uploadMiddleware.js'; // Import hàm bọc
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireStaff } from '../middleware/staffMiddleware.js';

const router = express.Router();

router.get('/', LocationController.getAllLocations);
router.get('/:id', LocationController.getLocationById);

// Cấu hình dịch vụ hiển thị theo cơ sở
router.get('/:id/services', LocationController.getServices);
router.put('/:id/services', authenticateToken, requireStaff, LocationController.updateServices);

// Truyền tham số 'locations' -> Ảnh tự động lưu vào 'uploads/locations/'
router.post('/', uploadDynamic('locations').array('images', 10), LocationController.createLocation);
router.put('/:id', uploadDynamic('locations').array('images', 10), LocationController.updateLocation);

router.patch('/:id/payment', LocationController.updatePaymentInfo);
router.post('/:id/qr', uploadDynamic('locations').single('qrImage'), LocationController.uploadQR);
router.post('/:id/signature', LocationController.uploadSignature);

router.delete('/:id', LocationController.deleteLocation);

export default router;