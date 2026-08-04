const express = require('express');
const router = express.Router();
const {
    getMembershipList,
    getMembershipSummary,
    getMembershipById,
    getCustomerMemberships,
    registerMembership,
    updateMembership,
    extendMembership,
    cancelMembership,
    confirmPayment,
    deductPtSession,
    refreshMembershipStatuses,
    deleteMembership,
    getMembershipMeta
} = require('../controllers/userPackageController');

// GET /api/v2/user-packages/meta - Danh sách trạng thái, phương thức thanh toán
router.get('/meta', getMembershipMeta);

// GET /api/v2/user-packages/summary - Tổng quan gói hội viên
router.get('/summary', getMembershipSummary);

// POST /api/v2/user-packages/refresh-status - Cập nhật trạng thái theo hạn sử dụng
router.post('/refresh-status', refreshMembershipStatuses);

// POST /api/v2/user-packages/register - Đăng ký gói cho hội viên
router.post('/register', registerMembership);

// GET /api/v2/user-packages/by-customer/:customerId - Gói của một hội viên
router.get('/by-customer/:customerId', getCustomerMemberships);

// GET /api/v2/user-packages - Danh sách gói hội viên
router.get('/', getMembershipList);

// POST /api/v2/user-packages - Tạo gói hội viên (tương đương register)
router.post('/', registerMembership);

// GET /api/v2/user-packages/:id - Chi tiết gói hội viên
router.get('/:id', getMembershipById);

// PUT /api/v2/user-packages/:id - Cập nhật gói hội viên
router.put('/:id', updateMembership);

// PATCH /api/v2/user-packages/:id/extend - Gia hạn gói
router.patch('/:id/extend', extendMembership);

// PATCH /api/v2/user-packages/:id/cancel - Hủy gói
router.patch('/:id/cancel', cancelMembership);

// PATCH /api/v2/user-packages/:id/payment - Xác nhận thanh toán
router.patch('/:id/payment', confirmPayment);

// POST /api/v2/user-packages/:id/pt-sessions/deduct - Trừ buổi PT
router.post('/:id/pt-sessions/deduct', deductPtSession);

// DELETE /api/v2/user-packages/:id - Xóa gói hội viên
router.delete('/:id', deleteMembership);

module.exports = router;

