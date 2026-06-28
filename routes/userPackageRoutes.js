import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  registerPackage, listMyPackages, getRegistrationDetail,
  cancelRegistration, confirmPayment, getContractPDF,
  adminListRegistrations, adminApproveRegistration,
  adminRegisterPackage
} from '../controllers/userPackageController.js';

const router = express.Router();

const requireStaff = (req, res, next) => {
  if (!req.user?.isStaff) {
    return res.status(403).json({ error: 'Hành động bị từ chối! Bạn không đủ thẩm quyền.' });
  }
  next();
};

router.post('/register', authenticateToken, registerPackage);
router.post('/admin-register', authenticateToken, requireStaff, adminRegisterPackage);
router.get('/my', authenticateToken, listMyPackages);
router.get('/all', authenticateToken, requireStaff, adminListRegistrations);
router.post('/:id/approve', authenticateToken, requireStaff, adminApproveRegistration);
router.get('/:id', authenticateToken, getRegistrationDetail);
router.post('/:id/cancel', authenticateToken, cancelRegistration);
router.post('/:id/confirm-payment', authenticateToken, confirmPayment);
router.get('/:id/contract-pdf', getContractPDF);

export default router;
