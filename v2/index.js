const express = require('express');
const router = express.Router();

const lockerRoutesV2 = require('./routes/lockerRoutes');
const customerRoutesV2 = require('./routes/customerRoutes');
const staffRoutesV2 = require('./routes/staffRoutes');
const productRoutesV2 = require('./routes/productRoutes');

// Đăng ký các tuyến đường API v2 cho Tủ đồ, Khách hàng, Nhân viên và Sản phẩm
router.use('/lockers', lockerRoutesV2);
router.use('/customers', customerRoutesV2);
router.use('/staff', staffRoutesV2);
router.use('/products', productRoutesV2);

router.get('/health-check', (req, res) => {
    return res.status(200).json({
        status: 'OK',
        module: 'GymManager API V2',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;