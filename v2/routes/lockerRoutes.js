const express = require('express');
const router = express.Router();
const {
    validateLockerCode,
    formatLockerStatus,
    getLockerUsageRate
} = require('../controllers/lockerController');

// GET /api/v2/lockers/status - Lấy trạng thái tổng quan hệ thống tủ đồ
router.get('/status', (req, res) => {
    try {
        const sampleData = {
            total: 50,
            occupied: 18,
            maintenance: 2,
            available: 30
        };

        const usageRate = getLockerUsageRate(sampleData.total, sampleData.occupied);

        return res.status(200).json({
            success: true,
            message: "Lấy thông tin trạng thái tủ đồ V2 thành công",
            data: {
                ...sampleData,
                usageRate: `${usageRate}%`
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi lấy thông tin tủ đồ V2",
            error: error.message
        });
    }
});

// POST /api/v2/lockers/validate - Kiểm tra tính hợp lệ của mã tủ
router.post('/validate', (req, res) => {
    const { lockerCode } = req.body;
    const isValid = validateLockerCode(lockerCode);

    return res.status(200).json({
        success: true,
        lockerCode,
        isValid,
        message: isValid ? "Mã tủ đồ hợp lệ" : "Mã tủ đồ không đúng định dạng (Ví dụ đúng: LK-001)"
    });
});

module.exports = router;