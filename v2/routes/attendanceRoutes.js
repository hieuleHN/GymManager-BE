const express = require('express');
const router = express.Router();
const {
    getAttendanceList,
    getAttendanceSummary,
    getTodayAttendance,
    getAttendanceTrend,
    getMembersStatus,
    lookupMembership,
    checkIn,
    getMemberHistory,
    updateAttendance,
    deleteAttendance,
    getAttendanceMeta
} = require('../controllers/attendanceController');

// GET /api/v2/attendance/meta - Danh sách trạng thái & phương thức điểm danh
router.get('/meta', getAttendanceMeta);

// GET /api/v2/attendance/summary - Tổng quan điểm danh hôm nay
router.get('/summary', getAttendanceSummary);

// GET /api/v2/attendance/trend - Thống kê điểm danh theo ngày
router.get('/trend', getAttendanceTrend);

// GET /api/v2/attendance/today - Danh sách điểm danh hôm nay
router.get('/today', getTodayAttendance);

// GET /api/v2/attendance/members-status - Trạng thái điểm danh của hội viên đang hoạt động
router.get('/members-status', getMembersStatus);

// GET /api/v2/attendance/history - Lịch sử điểm danh của một hội viên (?customerId= hoặc ?phone=)
router.get('/history', getMemberHistory);

// POST /api/v2/attendance/lookup - Tra cứu hội viên theo số điện thoại
router.post('/lookup', lookupMembership);

// POST /api/v2/attendance/check-in - Điểm danh hội viên
router.post('/check-in', checkIn);

// GET /api/v2/attendance - Danh sách điểm danh (lọc theo ngày/trạng thái/tìm kiếm)
router.get('/', getAttendanceList);

// PUT /api/v2/attendance/:id - Cập nhật bản ghi điểm danh
router.put('/:id', updateAttendance);

// DELETE /api/v2/attendance/:id - Xóa bản ghi điểm danh
router.delete('/:id', deleteAttendance);

module.exports = router;

