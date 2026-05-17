import express from 'express';
import * as LocationController from '../controllers/locationController.js';

const router = express.Router();

router.get('/', LocationController.getAllLocations);
router.get('/:id', LocationController.getLocationById);
router.post('/', LocationController.createLocation);
router.put('/:id', LocationController.updateLocation);
router.delete('/:id', LocationController.deleteLocation);

export default router;