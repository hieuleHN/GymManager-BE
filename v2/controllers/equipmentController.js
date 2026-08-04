const {
    EquipmentV2,
    EQUIPMENT_CATEGORY,
    EQUIPMENT_CATEGORY_LABELS,
    EQUIPMENT_STATUS,
    EQUIPMENT_STATUS_LABELS,
    EQUIPMENT_CONDITION,
    EQUIPMENT_CONDITION_LABELS,
    REPORT_TYPE,
    REPORT_TYPE_LABELS,
    REPORT_STATUS,
    REPORT_STATUS_LABELS
} = require('../models/equipmentModel');
const {
    toDateKey,
    formatDateLabel,
    addDays,
    validateVietnamesePhone,
    generateEquipmentCode,
    generateReportCode,
    computeAvailable,
    isMaintenanceDue,
    isWarrantyExpired,
    filterEquipment,
    summarizeEquipment,
    filterReport,
    flattenReports
} = require('../services/equipmentService');

const formatPrice = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('vi-VN');
};

const getEquipmentMeta = async (req, res) => {
    try {
        const categories = Object.values(EQUIPMENT_CATEGORY).map(key => ({ key, label: EQUIPMENT_CATEGORY_LABELS[key] }));
        const statuses = Object.values(EQUIPMENT_STATUS).map(key => ({ key, label: EQUIPMENT_STATUS_LABELS[key] }));
        const conditions = Object.values(EQUIPMENT_CONDITION).map(key => ({ key, label: EQUIPMENT_CONDITION_LABELS[key] }));
        const reportTypes = Object.values(REPORT_TYPE).map(key => ({ key, label: REPORT_TYPE_LABELS[key] }));
        const reportStatuses = Object.values(REPORT_STATUS).map(key => ({ key, label: REPORT_STATUS_LABELS[key] }));
        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách danh mục thiết bị V2 thành công',
            data: { categories, statuses, conditions, reportTypes, reportStatuses }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh mục thiết bị V2',
            error: error.message
        });
    }
};

const getEquipmentList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const { search, category, status, condition } = req.query;

        const allItems = await EquipmentV2.find().sort({ createdAt: -1 });
        const filtered = allItems.filter(item => filterEquipment(item, { search, category, status, condition }));

        const skip = (page - 1) * limit;
        const data = filtered.slice(skip, skip + limit);

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách thiết bị V2 thành công',
            data,
            total: filtered.length,
            page,
            limit,
            totalPages: Math.ceil(filtered.length / limit)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách thiết bị V2',
            error: error.message
        });
    }
};

const getEquipmentById = async (req, res) => {
    try {
        const item = await EquipmentV2.findById(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thiết bị V2!'
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Lấy thông tin thiết bị V2 thành công',
            data: item
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy thông tin thiết bị V2',
            error: error.message
        });
    }
};

const createEquipment = async (req, res) => {
    try {
        const {
            name, category, brand, model, quantity, unitPrice, supplier, supplierPhone,
            supplierAddress, purchaser, purchaseDate, warrantyMonths, location,
            status, condition, nextMaintenanceDate, description
        } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập tên thiết bị!' });
        }
        const qty = parseInt(quantity) || 1;
        if (qty < 1) {
            return res.status(400).json({ success: false, message: 'Số lượng phải lớn hơn 0!' });
        }
        if (supplierPhone && !validateVietnamesePhone(supplierPhone)) {
            return res.status(400).json({ success: false, message: 'Số điện thoại nhà cung cấp không hợp lệ!' });
        }

        const equipmentCode = await generateEquipmentCode();
        const item = await EquipmentV2.create({
            equipmentCode,
            name: String(name).trim(),
            category: Object.values(EQUIPMENT_CATEGORY).includes(category) ? category : EQUIPMENT_CATEGORY.OTHER,
            brand: brand || '',
            model: model || '',
            quantity: qty,
            unitPrice: Number(unitPrice) || 0,
            supplier: supplier || '',
            supplierPhone: supplierPhone || '',
            supplierAddress: supplierAddress || '',
            purchaser: purchaser || '',
            purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
            warrantyMonths: Number(warrantyMonths) || 12,
            location: location || '',
            status: Object.values(EQUIPMENT_STATUS).includes(status) ? status : EQUIPMENT_STATUS.ACTIVE,
            condition: Object.values(EQUIPMENT_CONDITION).includes(condition) ? condition : EQUIPMENT_CONDITION.GOOD,
            nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : null,
            description: description || ''
        });

        return res.status(201).json({
            success: true,
            message: `Thêm thiết bị "${item.name}" thành công`,
            data: item
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi thêm thiết bị V2',
            error: error.message
        });
    }
};

const updateEquipment = async (req, res) => {
    try {
        const item = await EquipmentV2.findById(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thiết bị V2!'
            });
        }

        const {
            name, category, brand, model, quantity, inUse, damaged, underMaintenance,
            unitPrice, supplier, supplierPhone,
            supplierAddress, purchaser, purchaseDate, warrantyMonths, location,
            status, condition, lastMaintenanceDate, nextMaintenanceDate, description
        } = req.body;

        if (name !== undefined && !String(name).trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập tên thiết bị!' });
        }
        if (supplierPhone !== undefined && supplierPhone && !validateVietnamesePhone(supplierPhone)) {
            return res.status(400).json({ success: false, message: 'Số điện thoại nhà cung cấp không hợp lệ!' });
        }

        if (name !== undefined) item.name = String(name).trim();
        if (category !== undefined && Object.values(EQUIPMENT_CATEGORY).includes(category)) item.category = category;
        if (brand !== undefined) item.brand = brand;
        if (model !== undefined) item.model = model;
        if (unitPrice !== undefined) item.unitPrice = Number(unitPrice) || 0;
        if (supplier !== undefined) item.supplier = supplier;
        if (supplierPhone !== undefined) item.supplierPhone = supplierPhone;
        if (supplierAddress !== undefined) item.supplierAddress = supplierAddress;
        if (purchaser !== undefined) item.purchaser = purchaser;
        if (purchaseDate !== undefined) item.purchaseDate = new Date(purchaseDate);
        if (warrantyMonths !== undefined) item.warrantyMonths = Number(warrantyMonths) || 12;
        if (location !== undefined) item.location = location;
        if (status !== undefined && Object.values(EQUIPMENT_STATUS).includes(status)) item.status = status;
        if (condition !== undefined && Object.values(EQUIPMENT_CONDITION).includes(condition)) item.condition = condition;
        if (lastMaintenanceDate !== undefined) item.lastMaintenanceDate = lastMaintenanceDate ? new Date(lastMaintenanceDate) : null;
        if (nextMaintenanceDate !== undefined) item.nextMaintenanceDate = nextMaintenanceDate ? new Date(nextMaintenanceDate) : null;
        if (description !== undefined) item.description = description;

        const wantsQuantityChange = quantity !== undefined || inUse !== undefined || damaged !== undefined || underMaintenance !== undefined;
        if (wantsQuantityChange) {
            const newQty = quantity !== undefined ? parseInt(quantity) : item.quantity;
            const newInUse = inUse !== undefined ? parseInt(inUse) : item.inUse;
            const newDamaged = damaged !== undefined ? parseInt(damaged) : item.damaged;
            const newMaint = underMaintenance !== undefined ? parseInt(underMaintenance) : item.underMaintenance;

            if (isNaN(newQty) || newQty < 1) {
                return res.status(400).json({ success: false, message: 'Tổng số lượng không hợp lệ!' });
            }
            if (isNaN(newInUse) || isNaN(newDamaged) || isNaN(newMaint) || newInUse < 0 || newDamaged < 0 || newMaint < 0) {
                return res.status(400).json({ success: false, message: 'Số lượng không thể âm!' });
            }
            if (newInUse + newDamaged + newMaint > newQty) {
                return res.status(400).json({
                    success: false,
                    message: `Tổng đang dùng/hỏng/bảo trì (${newInUse + newDamaged + newMaint}) vượt quá tổng số lượng (${newQty})!`
                });
            }

            item.quantity = newQty;
            item.inUse = newInUse;
            item.damaged = newDamaged;
            item.underMaintenance = newMaint;

            if (item.damaged > 0 && item.condition === EQUIPMENT_CONDITION.GOOD) {
                item.condition = EQUIPMENT_CONDITION.DAMAGED;
            }
            if (item.damaged === 0 && item.condition === EQUIPMENT_CONDITION.DAMAGED) {
                item.condition = EQUIPMENT_CONDITION.GOOD;
            }
        }

        const saved = await item.save();
        return res.status(200).json({
            success: true,
            message: 'Cập nhật thiết bị V2 thành công',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi cập nhật thiết bị V2',
            error: error.message
        });
    }
};

const deleteEquipment = async (req, res) => {
    try {
        const item = await EquipmentV2.findById(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thiết bị V2!'
            });
        }
        if (item.pendingReportCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Thiết bị còn báo cáo đang xử lý, không thể xóa!'
            });
        }
        await EquipmentV2.findByIdAndDelete(item._id);
        return res.status(200).json({
            success: true,
            message: `Xóa thiết bị "${item.name}" thành công`
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xóa thiết bị V2',
            error: error.message
        });
    }
};

const toggleEquipmentStatus = async (req, res) => {
    try {
        const item = await EquipmentV2.findById(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thiết bị V2!'
            });
        }
        const { status } = req.body;
        if (!Object.values(EQUIPMENT_STATUS).includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ!' });
        }
        item.status = status;
        const saved = await item.save();
        return res.status(200).json({
            success: true,
            message: `Đã chuyển thiết bị sang trạng thái "${EQUIPMENT_STATUS_LABELS[status]}"`,
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi đổi trạng thái thiết bị V2',
            error: error.message
        });
    }
};

const adjustQuantity = async (req, res) => {
    try {
        const { quantity, inUse, damaged, underMaintenance } = req.body;
        const item = await EquipmentV2.findById(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thiết bị V2!'
            });
        }

        const newQty = quantity !== undefined ? parseInt(quantity) : item.quantity;
        const newInUse = inUse !== undefined ? parseInt(inUse) : item.inUse;
        const newDamaged = damaged !== undefined ? parseInt(damaged) : item.damaged;
        const newMaint = underMaintenance !== undefined ? parseInt(underMaintenance) : item.underMaintenance;

        if (isNaN(newQty) || newQty < 1) {
            return res.status(400).json({ success: false, message: 'Tổng số lượng không hợp lệ!' });
        }
        if (isNaN(newInUse) || isNaN(newDamaged) || isNaN(newMaint) || newInUse < 0 || newDamaged < 0 || newMaint < 0) {
            return res.status(400).json({ success: false, message: 'Số lượng không thể âm!' });
        }
        if (newInUse + newDamaged + newMaint > newQty) {
            return res.status(400).json({
                success: false,
                message: `Tổng đang dùng/hỏng/bảo trì (${newInUse + newDamaged + newMaint}) vượt quá tổng số lượng (${newQty})!`
            });
        }

        item.quantity = newQty;
        item.inUse = newInUse;
        item.damaged = newDamaged;
        item.underMaintenance = newMaint;

        if (item.damaged > 0 && item.condition === EQUIPMENT_CONDITION.GOOD) {
            item.condition = EQUIPMENT_CONDITION.DAMAGED;
        }
        if (item.damaged === 0 && item.condition === EQUIPMENT_CONDITION.DAMAGED) {
            item.condition = EQUIPMENT_CONDITION.GOOD;
        }

        const saved = await item.save();
        return res.status(200).json({
            success: true,
            message: `Cập nhật số lượng "${saved.name}" thành công, còn ${computeAvailable(saved)} sẵn sàng`,
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi cập nhật số lượng thiết bị V2',
            error: error.message
        });
    }
};

const addReport = async (req, res) => {
    try {
        const { reportType, affectedQuantity, reason, note } = req.body;
        const item = await EquipmentV2.findById(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thiết bị V2!'
            });
        }
        if (!Object.values(REPORT_TYPE).includes(reportType)) {
            return res.status(400).json({ success: false, message: 'Loại báo cáo không hợp lệ!' });
        }
        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do báo cáo!' });
        }
        const qty = parseInt(affectedQuantity) || 1;
        if (qty < 1) {
            return res.status(400).json({ success: false, message: 'Số lượng báo cáo phải lớn hơn 0!' });
        }
        if ((reportType === REPORT_TYPE.DAMAGE || reportType === REPORT_TYPE.MAINTENANCE) && qty > computeAvailable(item)) {
            return res.status(400).json({ success: false, message: 'Số lượng báo cáo vượt quá số lượng sẵn sàng!' });
        }

        const reportCode = await generateReportCode(item._id);
        item.reports.push({
            reportCode,
            reportType,
            affectedQuantity: qty,
            reason: String(reason).trim(),
            note: note || '',
            status: REPORT_STATUS.PENDING,
            reportedAt: new Date()
        });

        if (reportType === REPORT_TYPE.DAMAGE) {
            item.damaged += qty;
            item.condition = EQUIPMENT_CONDITION.DAMAGED;
        } else if (reportType === REPORT_TYPE.MAINTENANCE) {
            item.underMaintenance += qty;
            item.condition = EQUIPMENT_CONDITION.MAINTENANCE;
        } else if (reportType === REPORT_TYPE.MISSING_PART) {
            item.condition = EQUIPMENT_CONDITION.REPAIRING;
        }

        const saved = await item.save();
        const report = saved.reports[saved.reports.length - 1];
        return res.status(201).json({
            success: true,
            message: `Đã gửi báo cáo ${REPORT_TYPE_LABELS[reportType].toLowerCase()} cho "${saved.name}"`,
            data: { equipment: saved, report }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi gửi báo cáo thiết bị V2',
            error: error.message
        });
    }
};

const resolveReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { resolvedBy } = req.body;
        const item = await EquipmentV2.findById(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thiết bị V2!'
            });
        }
        const report = item.reports.id(reportId);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy báo cáo thiết bị V2!'
            });
        }
        if (report.status === REPORT_STATUS.RESOLVED) {
            return res.status(400).json({ success: false, message: 'Báo cáo đã được xử lý!' });
        }

        report.status = REPORT_STATUS.RESOLVED;
        report.resolvedAt = new Date();
        report.resolvedBy = resolvedBy || '';

        if (report.reportType === REPORT_TYPE.DAMAGE) {
            item.damaged = Math.max(0, (Number(item.damaged) || 0) - report.affectedQuantity);
        } else if (report.reportType === REPORT_TYPE.MAINTENANCE) {
            item.underMaintenance = Math.max(0, (Number(item.underMaintenance) || 0) - report.affectedQuantity);
            item.lastMaintenanceDate = new Date();
        }

        if (item.damaged === 0 && item.underMaintenance === 0 && item.condition !== EQUIPMENT_CONDITION.GOOD) {
            item.condition = EQUIPMENT_CONDITION.GOOD;
        }

        const saved = await item.save();
        return res.status(200).json({
            success: true,
            message: `Đã xử lý báo cáo "${report.reportCode}"`,
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xử lý báo cáo thiết bị V2',
            error: error.message
        });
    }
};

const getReportList = async (req, res) => {
    try {
        const { reportType, status, date } = req.query;
        const allItems = await EquipmentV2.find().select('_id equipmentCode name reports condition');
        const reports = flattenReports(allItems).filter(report => filterReport(report, { reportType, status, date }));

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách báo cáo thiết bị V2 thành công',
            data: reports,
            total: reports.length
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách báo cáo thiết bị V2',
            error: error.message
        });
    }
};

const getEquipmentStats = async (req, res) => {
    try {
        const allItems = await EquipmentV2.find();
        const summary = summarizeEquipment(allItems);
        const pendingReports = flattenReports(allItems).filter(report => report.status === REPORT_STATUS.PENDING);
        const activeItems = allItems.filter(item => item.status === EQUIPMENT_STATUS.ACTIVE);

        return res.status(200).json({
            success: true,
            message: 'Lấy thống kê thiết bị V2 thành công',
            data: {
                ...summary,
                pendingReportsCount: pendingReports.length,
                activeCount: activeItems.length,
                generatedAt: new Date()
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy thống kê thiết bị V2',
            error: error.message
        });
    }
};

const getMaintenanceSchedule = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const allItems = await EquipmentV2.find();
        const horizon = addDays(new Date(), days);

        const dueItems = allItems.filter(item => {
            if (!item.nextMaintenanceDate) return false;
            return new Date(item.nextMaintenanceDate) <= horizon;
        });

        const data = dueItems.map(item => ({
            _id: item._id,
            equipmentCode: item.equipmentCode,
            name: item.name,
            category: item.category,
            categoryLabel: item.categoryLabel,
            location: item.location,
            condition: item.condition,
            conditionLabel: item.conditionLabel,
            lastMaintenanceDate: item.lastMaintenanceDate,
            lastMaintenanceLabel: formatDateLabel(item.lastMaintenanceDate),
            nextMaintenanceDate: item.nextMaintenanceDate,
            nextMaintenanceLabel: formatDateLabel(item.nextMaintenanceDate),
            daysRemaining: item.nextMaintenanceDate
                ? Math.max(0, Math.ceil((new Date(item.nextMaintenanceDate) - new Date()) / 86400000))
                : null,
            overdue: item.nextMaintenanceDate && new Date(item.nextMaintenanceDate) < new Date()
        }));

        data.sort((a, b) => (a.overdue === b.overdue ? (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0) : (a.overdue ? -1 : 1)));

        return res.status(200).json({
            success: true,
            message: 'Lấy lịch bảo trì thiết bị V2 thành công',
            data,
            total: data.length,
            days
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy lịch bảo trì thiết bị V2',
            error: error.message
        });
    }
};

module.exports = {
    formatPrice,
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
};
