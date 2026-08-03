const mongoose = require('mongoose');

const MEMBERSHIP_STATUS = {
    ACTIVE: 'ACTIVE',
    EXPIRING_SOON: 'EXPIRING_SOON',
    EXPIRED: 'EXPIRED',
    CANCELLED: 'CANCELLED'
};

const PAYMENT_STATUS = {
    PENDING: 'PENDING',
    PAID: 'PAID',
    CANCELLED: 'CANCELLED'
};

const PAYMENT_METHOD = {
    CASH: 'CASH',
    TRANSFER: 'TRANSFER',
    CARD: 'CARD'
};

const EXPIRING_SOON_DAYS = 10;

const MEMBERSHIP_STATUS_LABELS = {
    [MEMBERSHIP_STATUS.ACTIVE]: 'Đang hoạt động',
    [MEMBERSHIP_STATUS.EXPIRING_SOON]: 'Sắp hết hạn',
    [MEMBERSHIP_STATUS.EXPIRED]: 'Đã hết hạn',
    [MEMBERSHIP_STATUS.CANCELLED]: 'Đã hủy'
};

const PAYMENT_STATUS_LABELS = {
    [PAYMENT_STATUS.PENDING]: 'Chờ thanh toán',
    [PAYMENT_STATUS.PAID]: 'Đã thanh toán',
    [PAYMENT_STATUS.CANCELLED]: 'Đã hủy'
};

const PAYMENT_METHOD_LABELS = {
    [PAYMENT_METHOD.CASH]: 'Tiền mặt',
    [PAYMENT_METHOD.TRANSFER]: 'Chuyển khoản',
    [PAYMENT_METHOD.CARD]: 'Thẻ'
};

const userPackageSchemaV2 = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CustomerV2',
        default: null
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
    packageType: {
        type: String,
        default: 'STANDARD'
    },
    durationMonths: {
        type: Number,
        default: 1,
        min: 1
    },
    ptSessionsPerMonth: {
        type: Number,
        default: 0,
        min: 0
    },
    usedSessions: {
        type: Number,
        default: 0,
        min: 0
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    totalPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    paymentStatus: {
        type: String,
        enum: Object.values(PAYMENT_STATUS),
        default: PAYMENT_STATUS.PAID
    },
    paymentMethod: {
        type: String,
        enum: Object.values(PAYMENT_METHOD),
        default: PAYMENT_METHOD.CASH
    },
    paidAt: {
        type: Date,
        default: null
    },
    membershipCode: {
        type: String,
        default: ''
    },
    note: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: Object.values(MEMBERSHIP_STATUS),
        default: MEMBERSHIP_STATUS.ACTIVE
    }
}, {
    timestamps: true
});

userPackageSchemaV2.virtual('remainingDays').get(function () {
    if (!this.endDate) return 0;
    const now = new Date();
    const end = new Date(this.endDate);
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

userPackageSchemaV2.virtual('totalDurationDays').get(function () {
    if (!this.startDate || !this.endDate) return 0;
    const diff = new Date(this.endDate).getTime() - new Date(this.startDate).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

userPackageSchemaV2.virtual('progressPercent').get(function () {
    const total = this.totalDurationDays;
    const remaining = this.remainingDays;
    if (!total) return 0;
    const elapsed = total - remaining;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
});

userPackageSchemaV2.virtual('sessionsLeft').get(function () {
    const totalAllowed = (this.ptSessionsPerMonth || 0) * (this.durationMonths || 0);
    return Math.max(0, totalAllowed - (this.usedSessions || 0));
});

userPackageSchemaV2.virtual('statusLabel').get(function () {
    return MEMBERSHIP_STATUS_LABELS[this.status] || this.status;
});

userPackageSchemaV2.virtual('paymentStatusLabel').get(function () {
    return PAYMENT_STATUS_LABELS[this.paymentStatus] || this.paymentStatus;
});

userPackageSchemaV2.set('toJSON', { virtuals: true });
userPackageSchemaV2.set('toObject', { virtuals: true });

module.exports = {
    MEMBERSHIP_STATUS,
    MEMBERSHIP_STATUS_LABELS,
    PAYMENT_STATUS,
    PAYMENT_STATUS_LABELS,
    PAYMENT_METHOD,
    PAYMENT_METHOD_LABELS,
    EXPIRING_SOON_DAYS,
    UserPackageV2: mongoose.models.UserPackageV2 || mongoose.model('UserPackageV2', userPackageSchemaV2)
};
