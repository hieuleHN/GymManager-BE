const mongoose = require('mongoose');

const EQUIPMENT_CATEGORY = {
    CARDIO: 'CARDIO',
    STRENGTH: 'STRENGTH',
    FREE_WEIGHTS: 'FREE_WEIGHTS',
    FUNCTIONAL: 'FUNCTIONAL',
    RECOVERY: 'RECOVERY',
    OTHER: 'OTHER'
};

const EQUIPMENT_CATEGORY_LABELS = {
    [EQUIPMENT_CATEGORY.CARDIO]: 'Máy cardio',
    [EQUIPMENT_CATEGORY.STRENGTH]: 'Máy tập lực',
    [EQUIPMENT_CATEGORY.FREE_WEIGHTS]: 'Tạ tự do',
    [EQUIPMENT_CATEGORY.FUNCTIONAL]: 'Dụng cụ functional',
    [EQUIPMENT_CATEGORY.RECOVERY]: 'Phục hồi',
    [EQUIPMENT_CATEGORY.OTHER]: 'Khác'
};

const EQUIPMENT_STATUS = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    DISCONTINUED: 'DISCONTINUED'
};

const EQUIPMENT_STATUS_LABELS = {
    [EQUIPMENT_STATUS.ACTIVE]: 'Đang sử dụng',
    [EQUIPMENT_STATUS.INACTIVE]: 'Ngừng dùng',
    [EQUIPMENT_STATUS.DISCONTINUED]: 'Đã thanh lý'
};

const EQUIPMENT_CONDITION = {
    GOOD: 'GOOD',
    MAINTENANCE: 'MAINTENANCE',
    DAMAGED: 'DAMAGED',
    REPAIRING: 'REPAIRING'
};

const EQUIPMENT_CONDITION_LABELS = {
    [EQUIPMENT_CONDITION.GOOD]: 'Tốt',
    [EQUIPMENT_CONDITION.MAINTENANCE]: 'Bảo trì',
    [EQUIPMENT_CONDITION.DAMAGED]: 'Hỏng hóc',
    [EQUIPMENT_CONDITION.REPAIRING]: 'Đang sửa chữa'
};

const REPORT_TYPE = {
    DAMAGE: 'DAMAGE',
    MAINTENANCE: 'MAINTENANCE',
    MISSING_PART: 'MISSING_PART',
    CLEANING: 'CLEANING'
};

const REPORT_TYPE_LABELS = {
    [REPORT_TYPE.DAMAGE]: 'Hỏng hóc',
    [REPORT_TYPE.MAINTENANCE]: 'Bảo trì',
    [REPORT_TYPE.MISSING_PART]: 'Thiếu linh kiện',
    [REPORT_TYPE.CLEANING]: 'Vệ sinh'
};

const REPORT_STATUS = {
    PENDING: 'PENDING',
    RESOLVED: 'RESOLVED'
};

const REPORT_STATUS_LABELS = {
    [REPORT_STATUS.PENDING]: 'Đang xử lý',
    [REPORT_STATUS.RESOLVED]: 'Đã xử lý'
};

const equipmentReportSchemaV2 = new mongoose.Schema({
    reportCode: {
        type: String,
        required: true,
        trim: true
    },
    reportType: {
        type: String,
        enum: Object.values(REPORT_TYPE),
        required: true
    },
    affectedQuantity: {
        type: Number,
        default: 1,
        min: 1
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: Object.values(REPORT_STATUS),
        default: REPORT_STATUS.PENDING
    },
    note: {
        type: String,
        default: ''
    },
    reportedAt: {
        type: Date,
        default: Date.now
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    resolvedBy: {
        type: String,
        default: ''
    }
});

const equipmentSchemaV2 = new mongoose.Schema({
    equipmentCode: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: Object.values(EQUIPMENT_CATEGORY),
        default: EQUIPMENT_CATEGORY.OTHER
    },
    brand: {
        type: String,
        default: ''
    },
    model: {
        type: String,
        default: ''
    },
    quantity: {
        type: Number,
        default: 1,
        min: 1
    },
    inUse: {
        type: Number,
        default: 0,
        min: 0
    },
    damaged: {
        type: Number,
        default: 0,
        min: 0
    },
    underMaintenance: {
        type: Number,
        default: 0,
        min: 0
    },
    unitPrice: {
        type: Number,
        default: 0
    },
    supplier: {
        type: String,
        default: ''
    },
    supplierPhone: {
        type: String,
        default: ''
    },
    supplierAddress: {
        type: String,
        default: ''
    },
    purchaser: {
        type: String,
        default: ''
    },
    purchaseDate: {
        type: Date,
        default: Date.now
    },
    warrantyMonths: {
        type: Number,
        default: 12
    },
    location: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: Object.values(EQUIPMENT_STATUS),
        default: EQUIPMENT_STATUS.ACTIVE
    },
    condition: {
        type: String,
        enum: Object.values(EQUIPMENT_CONDITION),
        default: EQUIPMENT_CONDITION.GOOD
    },
    lastMaintenanceDate: {
        type: Date,
        default: null
    },
    nextMaintenanceDate: {
        type: Date,
        default: null
    },
    description: {
        type: String,
        default: ''
    },
    reports: {
        type: [equipmentReportSchemaV2],
        default: []
    }
}, {
    timestamps: true
});

equipmentSchemaV2.virtual('availableQuantity').get(function () {
    return Math.max(0, (Number(this.quantity) || 0) - (Number(this.inUse) || 0) - (Number(this.damaged) || 0) - (Number(this.underMaintenance) || 0));
});

equipmentSchemaV2.virtual('totalValue').get(function () {
    return (Number(this.quantity) || 0) * (Number(this.unitPrice) || 0);
});

equipmentSchemaV2.virtual('categoryLabel').get(function () {
    return EQUIPMENT_CATEGORY_LABELS[this.category] || this.category;
});

equipmentSchemaV2.virtual('statusLabel').get(function () {
    return EQUIPMENT_STATUS_LABELS[this.status] || this.status;
});

equipmentSchemaV2.virtual('conditionLabel').get(function () {
    return EQUIPMENT_CONDITION_LABELS[this.condition] || this.condition;
});

equipmentSchemaV2.virtual('warrantyExpiryDate').get(function () {
    if (!this.purchaseDate) return null;
    const d = new Date(this.purchaseDate);
    d.setMonth(d.getMonth() + (Number(this.warrantyMonths) || 0));
    return d;
});

equipmentSchemaV2.virtual('warrantyExpired').get(function () {
    const expiry = this.warrantyExpiryDate;
    if (!expiry) return false;
    return new Date(expiry) < new Date();
});

equipmentSchemaV2.virtual('purchaseDateLabel').get(function () {
    if (!this.purchaseDate) return '';
    const d = new Date(this.purchaseDate);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
});

equipmentSchemaV2.virtual('pendingReportCount').get(function () {
    return (this.reports || []).filter(report => report.status === REPORT_STATUS.PENDING).length;
});

equipmentSchemaV2.set('toJSON', { virtuals: true });
equipmentSchemaV2.set('toObject', { virtuals: true });

module.exports = {
    EQUIPMENT_CATEGORY,
    EQUIPMENT_CATEGORY_LABELS,
    EQUIPMENT_STATUS,
    EQUIPMENT_STATUS_LABELS,
    EQUIPMENT_CONDITION,
    EQUIPMENT_CONDITION_LABELS,
    REPORT_TYPE,
    REPORT_TYPE_LABELS,
    REPORT_STATUS,
    REPORT_STATUS_LABELS,
    EquipmentV2: mongoose.models.EquipmentV2 || mongoose.model('EquipmentV2', equipmentSchemaV2)
};
