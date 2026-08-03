const { EquipmentV2, EQUIPMENT_STATUS, EQUIPMENT_CONDITION, REPORT_STATUS } = require('../models/equipmentModel');

const toDateKey = (dateInput) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
};

const formatDateLabel = (dateInput) => {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const addDays = (dateInput, days) => {
    const d = new Date(dateInput);
    d.setDate(d.getDate() + days);
    return d;
};

const generateEquipmentCode = async () => {
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    let code = '';
    let exists = true;
    while (exists) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        code = `EQ-${ymd}-${rand}`;
        exists = await EquipmentV2.exists({ equipmentCode: code });
    }
    return code;
};

const generateReportCode = async (equipmentId) => {
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    let code = '';
    let exists = true;
    while (exists) {
        const rand = Math.floor(100 + Math.random() * 900);
        code = `RP-${ymd}-${rand}`;
        exists = await EquipmentV2.exists({
            _id: equipmentId,
            'reports.reportCode': code
        });
    }
    return code;
};

const computeAvailable = (item) => {
    return Math.max(0, (Number(item.quantity) || 0) - (Number(item.inUse) || 0) - (Number(item.damaged) || 0) - (Number(item.underMaintenance) || 0));
};

const isMaintenanceDue = (item) => {
    if (!item.nextMaintenanceDate) return false;
    const due = new Date(item.nextMaintenanceDate);
    const horizon = addDays(new Date(), 30);
    return due <= horizon;
};

const isWarrantyExpired = (item) => {
    if (!item.purchaseDate) return false;
    const d = new Date(item.purchaseDate);
    d.setMonth(d.getMonth() + (Number(item.warrantyMonths) || 0));
    return d < new Date();
};

const filterEquipment = (item, { search, category, status, condition } = {}) => {
    if (category && category !== 'ALL' && item.category !== category) return false;
    if (status && status !== 'ALL' && item.status !== status) return false;
    if (condition && condition !== 'ALL' && item.condition !== condition) return false;
    if (search) {
        const keyword = String(search).trim().toLowerCase();
        if (!keyword) return true;
        const matchCode = (item.equipmentCode || '').toLowerCase().includes(keyword);
        const matchName = (item.name || '').toLowerCase().includes(keyword);
        const matchBrand = (item.brand || '').toLowerCase().includes(keyword);
        const matchSupplier = (item.supplier || '').toLowerCase().includes(keyword);
        const matchLocation = (item.location || '').toLowerCase().includes(keyword);
        if (!matchCode && !matchName && !matchBrand && !matchSupplier && !matchLocation) return false;
    }
    return true;
};

const buildCounts = (list, keyFn) => {
    const counts = {};
    list.forEach(item => {
        const key = keyFn(item);
        counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
};

const summarizeEquipment = (list) => {
    let totalQuantity = 0;
    let totalValue = 0;
    let damagedCount = 0;
    let maintenanceDueCount = 0;
    let pendingReportCount = 0;

    list.forEach(item => {
        totalQuantity += Number(item.quantity) || 0;
        totalValue += computeAvailable(item) * (Number(item.unitPrice) || 0);
        if ((Number(item.damaged) || 0) > 0) damagedCount += 1;
        if (isMaintenanceDue(item)) maintenanceDueCount += 1;
        pendingReportCount += item.pendingReportCount || 0;
    });

    return {
        totalItems: list.length,
        totalQuantity,
        totalValue,
        damagedCount,
        maintenanceDueCount,
        pendingReportCount,
        categoryCounts: buildCounts(list, item => item.category),
        statusCounts: buildCounts(list, item => item.status),
        conditionCounts: buildCounts(list, item => item.condition)
    };
};

const filterReport = (report, { reportType, status, date } = {}) => {
    if (reportType && reportType !== 'ALL' && report.reportType !== reportType) return false;
    if (status && status !== 'ALL' && report.status !== status) return false;
    if (date && toDateKey(report.reportedAt) !== String(date).slice(0, 10)) return false;
    return true;
};

const flattenReports = (equipmentList) => {
    const result = [];
    equipmentList.forEach(item => {
        (item.reports || []).forEach(report => {
            result.push({
                ...report.toObject ? report.toObject() : report,
                equipmentId: item._id,
                equipmentCode: item.equipmentCode,
                equipmentName: item.name
            });
        });
    });
    return result.sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
};

module.exports = {
    EQUIPMENT_STATUS,
    EQUIPMENT_CONDITION,
    REPORT_STATUS,
    toDateKey,
    formatDateLabel,
    addDays,
    generateEquipmentCode,
    generateReportCode,
    computeAvailable,
    isMaintenanceDue,
    isWarrantyExpired,
    filterEquipment,
    buildCounts,
    summarizeEquipment,
    filterReport,
    flattenReports
};
