const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
    getStaffList,
    getStaffById,
    createStaff,
    updateStaff,
    deleteStaff,
    toggleStaffStatus,
    getRolesAndPermissions,
    getStaffSummary
} = require('../controllers/staffController');

// Gán middleware auth (xác định phòng tập hiện tại từ token)
router.use(auth);

// GET /api/v2/staff/summary - Lấy tổng quan nhân viên
router.get('/summary', getStaffSummary);

// GET /api/v2/staff/roles - Lấy danh sách vai trò và quyền
router.get('/roles', getRolesAndPermissions);

// GET /api/v2/staff - Lấy danh sách nhân viên
router.get('/', getStaffList);

// POST /api/v2/staff - Thêm nhân viên mới
router.post('/', createStaff);

// GET /api/v2/staff/:id - Chi tiết nhân viên
router.get('/:id', getStaffById);

// PUT /api/v2/staff/:id - Cập nhật nhân viên
router.put('/:id', updateStaff);

// PATCH /api/v2/staff/:id/status - Bật/tắt trạng thái nhân viên
router.patch('/:id/status', toggleStaffStatus);

// DELETE /api/v2/staff/:id - Xóa nhân viên
router.delete('/:id', deleteStaff);

module.exports = router;
