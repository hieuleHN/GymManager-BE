import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';
import * as PackageController from '../controllers/packageController.js';

const router = express.Router();

// Public routes
router.get('/', PackageController.listPackages);
router.get('/by-discipline/:disciplineId', PackageController.getPackagesByDisciplineId);
router.get('/:id/related', PackageController.listRelatedPackages);
router.get('/:id', PackageController.getPackageDetail);

// Admin routes (require authentication + staff role)
router.post('/', authenticateToken, authorizeRoles('admin', 'staff'), PackageController.addPackage);
router.put('/:id', authenticateToken, authorizeRoles('admin', 'staff'), PackageController.updatePackage);
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'staff'), PackageController.deletePackage);

export default router;