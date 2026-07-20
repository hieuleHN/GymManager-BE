import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { topup, pay, vnpayReturn, vnpayIPN, getBalance, getTransactions } from '../controllers/walletController.js';

const router = express.Router();

router.post('/topup', authenticateToken, topup);
router.post('/pay', authenticateToken, pay);
router.get('/balance', authenticateToken, getBalance);
router.get('/transactions', authenticateToken, getTransactions);
router.get('/vnpay-return', vnpayReturn);
router.get('/vnpay-ipn', vnpayIPN);

export default router;
