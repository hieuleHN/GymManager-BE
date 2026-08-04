const express = require('express');
const router = express.Router();
const {
    getBookingMeta,
    getBookingList,
    getBookingById,
    createBooking,
    updateBooking,
    deleteBooking,
    confirmBooking,
    rejectBooking,
    cancelBooking,
    completeBooking,
    requestTransfer,
    approveTransfer,
    rejectTransfer,
    getTrainerAvailability,
    getBookingStats,
    getTodaySchedule,
    getMemberBookings,
    lookupMember
} = require('../controllers/bookingController');

// GET /api/v2/bookings/meta - Danh sách trạng thái, loại buổi tập, thanh toán
router.get('/meta', getBookingMeta);

// GET /api/v2/bookings/stats - Thống kê lịch đặt (trạng thái, doanh thu, xu hướng)
router.get('/stats', getBookingStats);

// GET /api/v2/bookings/today - Lịch tập trong ngày (?date=YYYY-MM-DD)
router.get('/today', getTodaySchedule);

// GET /api/v2/bookings/availability - Lịch rảnh của PT (?trainerId= & date=)
router.get('/availability', getTrainerAvailability);

// GET /api/v2/bookings/member - Lịch sử đặt lịch của khách hàng (?customerId= hoặc ?phone=)
router.get('/member', getMemberBookings);

// POST /api/v2/bookings/lookup - Tra cứu khách hàng theo số điện thoại
router.post('/lookup', lookupMember);

// GET /api/v2/bookings - Danh sách lịch đặt (lọc theo trạng thái/loại buổi/ngày/tìm kiếm)
router.get('/', getBookingList);

// POST /api/v2/bookings - Tạo lịch đặt mới
router.post('/', createBooking);

// GET /api/v2/bookings/:id - Chi tiết lịch đặt
router.get('/:id', getBookingById);

// PUT /api/v2/bookings/:id - Cập nhật lịch đặt
router.put('/:id', updateBooking);

// PUT /api/v2/bookings/:id/confirm - Xác nhận lịch đặt
router.put('/:id/confirm', confirmBooking);

// PUT /api/v2/bookings/:id/reject - Từ chối lịch đặt (kèm lý do)
router.put('/:id/reject', rejectBooking);

// PUT /api/v2/bookings/:id/cancel - Hủy lịch đặt
router.put('/:id/cancel', cancelBooking);

// PUT /api/v2/bookings/:id/complete - Hoàn thành buổi tập
router.put('/:id/complete', completeBooking);

// PUT /api/v2/bookings/:id/transfer - Gửi yêu cầu chuyển PT / dời lịch
router.put('/:id/transfer', requestTransfer);

// PUT /api/v2/bookings/:id/transfer/approve - Duyệt yêu cầu chuyển lịch
router.put('/:id/transfer/approve', approveTransfer);

// PUT /api/v2/bookings/:id/transfer/reject - Từ chối yêu cầu chuyển lịch
router.put('/:id/transfer/reject', rejectTransfer);

// DELETE /api/v2/bookings/:id - Xóa lịch đặt
router.delete('/:id', deleteBooking);

module.exports = router;
