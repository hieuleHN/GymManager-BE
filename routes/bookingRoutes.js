import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  create,
  list,
  detail,
  getByTrainer,
  getByCustomer,
  confirmBooking,
  rejectBooking,
  checkConflict,
  getByLocation,
  updatePayment,
  createBookingVnPayUrl,
  bookingsVnpayReturn,
  bookingsVnpayIPN
} from '../controllers/bookingController.js';

const router = express.Router();

router.post('/', authenticateToken, create);
router.get('/', authenticateToken, list);
router.get('/my', authenticateToken, getByCustomer);
router.get('/check-conflict', authenticateToken, checkConflict);
router.get('/vnpay-return', bookingsVnpayReturn);
router.get('/vnpay-ipn', bookingsVnpayIPN);
router.post('/vnpay-ipn', bookingsVnpayIPN);
router.get('/trainer/:trainerId', authenticateToken, getByTrainer);
router.get('/location/:locationId', authenticateToken, getByLocation);
router.get('/:id/vnpay-url', authenticateToken, createBookingVnPayUrl);
router.put('/:id/confirm', authenticateToken, confirmBooking);
router.put('/:id/reject', authenticateToken, rejectBooking);
router.put('/:id/payment', authenticateToken, updatePayment);
router.get('/:id', authenticateToken, detail);

export default router;
