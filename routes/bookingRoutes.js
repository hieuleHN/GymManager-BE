import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  create,
  createBulk,
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
  createBulkVnpayUrl,
  bookingsVnpayReturn,
  bookingsVnpayIPN,
  requestTransfer,
  approveTransfer,
  rejectTransfer,
  listTransferRequests,
  getMyTrainerBookings
} from '../controllers/bookingController.js';

const router = express.Router();

router.post('/', authenticateToken, create);
router.post('/bulk', authenticateToken, createBulk);
router.get('/', authenticateToken, list);
router.get('/my', authenticateToken, getByCustomer);
router.get('/my-trainer', authenticateToken, getMyTrainerBookings);
router.get('/transfer-requests', authenticateToken, listTransferRequests);
router.get('/check-conflict', authenticateToken, checkConflict);
router.get('/vnpay-return', bookingsVnpayReturn);
router.get('/vnpay-ipn', bookingsVnpayIPN);
router.post('/vnpay-ipn', bookingsVnpayIPN);
router.post('/bulk-vnpay-url', authenticateToken, createBulkVnpayUrl);
router.get('/trainer/:trainerId', authenticateToken, getByTrainer);
router.get('/location/:locationId', authenticateToken, getByLocation);
router.get('/:id/vnpay-url', authenticateToken, createBookingVnPayUrl);
router.put('/:id/confirm', authenticateToken, confirmBooking);
router.put('/:id/reject', authenticateToken, rejectBooking);
router.put('/:id/payment', authenticateToken, updatePayment);
router.post('/:id/transfer', authenticateToken, requestTransfer);
router.put('/:id/approve-transfer', authenticateToken, approveTransfer);
router.put('/:id/reject-transfer', authenticateToken, rejectTransfer);
router.get('/:id', authenticateToken, detail);

export default router;
