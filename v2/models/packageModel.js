const mongoose = require('mongoose');

const PACKAGE_STATUS = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE'
};

const PACKAGE_TYPE = {
    STANDARD: 'STANDARD',
    COMBO: 'COMBO',
    PT: 'PT'
};

const PAYMENT_METHOD = {
    CASH: 'CASH',
    TRANSFER: 'TRANSFER',
    CARD: 'CARD'
};

const SALE_STATUS = {
    COMPLETED: 'COMPLETED',
    PENDING: 'PENDING',
    CANCELLED: 'CANCELLED'
};

const packageSchemaV2 = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: Object.values(PACKAGE_TYPE),
        default: PACKAGE_TYPE.STANDARD
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    originalPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    discountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    durationMonths: {
        type: Number,
        default: 1,
        min: 0
    },
    durationDays: {
        type: Number,
        default: 30,
        min: 0
    },
    ptSessionsPerMonth: {
        type: Number,
        default: 0,
        min: 0
    },
    isFullMonth: {
        type: Boolean,
        default: false
    },
    features: {
        type: [String],
        default: []
    },
    description: {
        type: String,
        default: ''
    },
    image: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: Object.values(PACKAGE_STATUS),
        default: PACKAGE_STATUS.ACTIVE
    },
    sold: {
        type: Number,
        default: 0,
        min: 0
    },
    totalRevenue: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true
});

packageSchemaV2.virtual('effectivePrice').get(function () {
    const price = this.price || 0;
    const discount = this.discountPercent || 0;
    if (discount <= 0) return price;
    return Math.round(price * (1 - discount / 100));
});

packageSchemaV2.virtual('hasDiscount').get(function () {
    return (this.discountPercent || 0) > 0;
});

packageSchemaV2.virtual('durationLabel').get(function () {
    if ((this.durationMonths || 0) > 0) {
        return `${this.durationMonths} tháng`;
    }
    return `${this.durationDays || 0} ngày`;
});

packageSchemaV2.virtual('typeLabel').get(function () {
    return PACKAGE_TYPE_LABELS[this.type] || this.type;
});

packageSchemaV2.set('toJSON', { virtuals: true });
packageSchemaV2.set('toObject', { virtuals: true });

const PACKAGE_TYPE_LABELS = {
    [PACKAGE_TYPE.STANDARD]: 'Gói tiêu chuẩn',
    [PACKAGE_TYPE.COMBO]: 'Gói combo',
    [PACKAGE_TYPE.PT]: 'Gói PT'
};

const packageSaleSchemaV2 = new mongoose.Schema({
    packageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PackageV2',
        default: null
    },
    packageName: {
        type: String,
        required: true,
        trim: true
    },
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    customerPhone: {
        type: String,
        required: true,
        trim: true
    },
    customerEmail: {
        type: String,
        default: '',
        trim: true
    },
    quantity: {
        type: Number,
        default: 1,
        min: 1
    },
    unitPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    discountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    totalPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    paymentMethod: {
        type: String,
        enum: Object.values(PAYMENT_METHOD),
        default: PAYMENT_METHOD.CASH
    },
    status: {
        type: String,
        enum: Object.values(SALE_STATUS),
        default: SALE_STATUS.COMPLETED
    },
    note: {
        type: String,
        default: ''
    },
    soldAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

packageSaleSchemaV2.virtual('statusLabel').get(function () {
    return SALE_STATUS_LABELS[this.status] || this.status;
});

packageSaleSchemaV2.virtual('paymentMethodLabel').get(function () {
    return PAYMENT_METHOD_LABELS[this.paymentMethod] || this.paymentMethod;
});

packageSaleSchemaV2.set('toJSON', { virtuals: true });
packageSaleSchemaV2.set('toObject', { virtuals: true });

const SALE_STATUS_LABELS = {
    [SALE_STATUS.COMPLETED]: 'Hoàn thành',
    [SALE_STATUS.PENDING]: 'Chờ thanh toán',
    [SALE_STATUS.CANCELLED]: 'Đã hủy'
};

const PAYMENT_METHOD_LABELS = {
    [PAYMENT_METHOD.CASH]: 'Tiền mặt',
    [PAYMENT_METHOD.TRANSFER]: 'Chuyển khoản',
    [PAYMENT_METHOD.CARD]: 'Thẻ'
};

module.exports = {
    PACKAGE_STATUS,
    PACKAGE_TYPE,
    PACKAGE_TYPE_LABELS,
    PAYMENT_METHOD,
    PAYMENT_METHOD_LABELS,
    SALE_STATUS,
    SALE_STATUS_LABELS,
    PackageV2: mongoose.models.PackageV2 || mongoose.model('PackageV2', packageSchemaV2),
    PackageSaleV2: mongoose.models.PackageSaleV2 || mongoose.model('PackageSaleV2', packageSaleSchemaV2)
};
