import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireStaff } from '../middleware/staffMiddleware.js';
import {
  createServiceRequest,
  myRequests,
  listRequests,
  handleRequest,
  payServiceRequest,
  payServiceRequestByWallet,
  markPaid,
  vnpayReturn,
  vnpayIPN
} from '../controllers/serviceRequestController.js';

const router = express.Router();

// Hội viên: tạo yêu cầu dịch vụ
router.post('/', authenticateToken, createServiceRequest);

// Hội viên: xem các yêu cầu của mình
router.get('/mine', authenticateToken, myRequests);

// Hội viên: thanh toán phí dịch vụ qua VNPay
router.post('/:id/pay', authenticateToken, payServiceRequest);

// Hội viên: thanh toán phí dịch vụ bằng Ví điện tử
router.post('/:id/wallet-pay', authenticateToken, payServiceRequestByWallet);

// Nhân viên: đánh dấu đã thu tiền (chuyển khoản / quầy)
router.patch('/:id/payment', authenticateToken, requireStaff, markPaid);

// Nhân viên: xem danh sách yêu cầu (lọc theo trạng thái/loại/cơ sở)
router.get('/', authenticateToken, requireStaff, listRequests);

// Nhân viên: chấp nhận / từ chối yêu cầu
router.patch('/:id', authenticateToken, requireStaff, handleRequest);

// VNPay callback (không cần xác thực - do VNPay gọi)
router.get('/vnpay-return', vnpayReturn);
router.get('/vnpay-ipn', vnpayIPN);

export default router;
