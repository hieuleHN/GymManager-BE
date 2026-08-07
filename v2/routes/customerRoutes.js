const express = require('express');
const router = express.Router();
const {
    validateVietnamesePhone,
    calculateMembershipStatus,
    formatCustomerName
} = require('../controllers/customerController');

router.get('/summary', (req, res) => {
    try {
        const sampleMembers = [
            { id: 1, name: "Nguyen Van A", expiry: "2026-12-31" },
            { id: 2, name: "Tran Thi B", expiry: "2026-08-05" },
            { id: 3, name: "Le Van C", expiry: "2026-01-01" }
        ];

        const processedData = sampleMembers.map(member => ({
            ...member,
            formattedName: formatCustomerName(member.name),
            status: calculateMembershipStatus(member.expiry)
        }));

        return res.status(200).json({
            success: true,
            message: "Lấy danh sách tổng quan hội viên V2 thành công",
            data: processedData
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi xử lý dữ liệu hội viên V2",
            error: error.message
        });
    }
});

router.post('/verify-phone', (req, res) => {
    const { phone } = req.body;
    const isValid = validateVietnamesePhone(phone);

    return res.status(200).json({
        success: true,
        phone,
        isValid,
        message: isValid ? "Số điện thoại hợp lệ" : "Số điện thoại không đúng định dạng Việt Nam"
    });
});

module.exports = router;