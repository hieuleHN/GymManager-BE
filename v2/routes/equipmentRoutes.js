const express = require('express');
const router = express.Router();
const {
    getEquipmentMeta,
    getEquipmentList,
    getEquipmentById,
    createEquipment,
    updateEquipment,
    deleteEquipment,
    toggleEquipmentStatus,
    adjustQuantity,
    addReport,
    resolveReport,
    getReportList,
    getEquipmentStats,
    getMaintenanceSchedule
} = require('../controllers/equipmentController');

// GET /api/v2/equipment/meta - Danh sách danh mục, trạng thái, loại báo cáo
router.get('/meta', getEquipmentMeta);

// GET /api/v2/equipment/stats - Thống kê thiết bị (giá trị, số lượng, tình trạng)
router.get('/stats', getEquipmentStats);

// GET /api/v2/equipment/reports - Danh sách báo cáo thiết bị (lọc theo loại/trạng thái/ngày)
router.get('/reports', getReportList);

// GET /api/v2/equipment/maintenance - Lịch bảo trì thiết bị (?days=30)
router.get('/maintenance', getMaintenanceSchedule);

// GET /api/v2/equipment - Danh sách thiết bị (lọc theo tìm kiếm/danh mục/trạng thái/tình trạng)
router.get('/', getEquipmentList);

// POST /api/v2/equipment - Thêm thiết bị mới
router.post('/', createEquipment);

// GET /api/v2/equipment/:id - Chi tiết thiết bị
router.get('/:id', getEquipmentById);

// PUT /api/v2/equipment/:id - Cập nhật thiết bị
router.put('/:id', updateEquipment);

// PATCH /api/v2/equipment/:id/status - Đổi trạng thái thiết bị
router.patch('/:id/status', toggleEquipmentStatus);

// POST /api/v2/equipment/:id/adjust-quantity - Điều chỉnh số lượng thiết bị
router.post('/:id/adjust-quantity', adjustQuantity);

// POST /api/v2/equipment/:id/reports - Gửi báo cáo hỏng hóc/bảo trì thiết bị
router.post('/:id/reports', addReport);

// PUT /api/v2/equipment/:id/reports/:reportId/resolve - Xử lý báo cáo thiết bị
router.put('/:id/reports/:reportId/resolve', resolveReport);

// DELETE /api/v2/equipment/:id - Xóa thiết bị
router.delete('/:id', deleteEquipment);

module.exports = router;
