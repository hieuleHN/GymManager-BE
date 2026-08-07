const express = require('express');
const router = express.Router();
const {
    getPackageList,
    getPackageSummary,
    getPackageTypes,
    getPackageById,
    getRelatedPackages,
    createPackage,
    updatePackage,
    togglePackageStatus,
    deletePackage,
    registerCheckout,
    getSaleList,
    getSaleSummary,
    updateSaleStatus,
    deleteSale
} = require('../controllers/packageController');

// GET /api/v2/packages/types - Danh sách loại gói & phương thức thanh toán
router.get('/types', getPackageTypes);

// GET /api/v2/packages/summary - Tổng quan gói tập
router.get('/summary', getPackageSummary);

// GET /api/v2/packages/sales/summary - Tổng quan giao dịch
router.get('/sales/summary', getSaleSummary);

// GET /api/v2/packages/sales - Danh sách giao dịch bán gói
router.get('/sales', getSaleList);

// PUT /api/v2/packages/sales/:id/status - Cập nhật trạng thái giao dịch
router.put('/sales/:id/status', updateSaleStatus);

// DELETE /api/v2/packages/sales/:id - Xóa giao dịch
router.delete('/sales/:id', deleteSale);

// GET /api/v2/packages - Danh sách gói tập
router.get('/', getPackageList);

// POST /api/v2/packages - Thêm gói tập mới
router.post('/', createPackage);

// GET /api/v2/packages/:id/related - Gói tập liên quan
router.get('/:id/related', getRelatedPackages);

// GET /api/v2/packages/:id - Chi tiết gói tập
router.get('/:id', getPackageById);

// PUT /api/v2/packages/:id - Cập nhật gói tập
router.put('/:id', updatePackage);

// PATCH /api/v2/packages/:id/status - Bật/tắt trạng thái gói tập
router.patch('/:id/status', togglePackageStatus);

// DELETE /api/v2/packages/:id - Xóa gói tập
router.delete('/:id', deletePackage);

// POST /api/v2/packages/:id/checkout - Đăng ký/mua gói tập
router.post('/:id/checkout', registerCheckout);

module.exports = router;
