const mongoose = require('mongoose');

const BOOKING_STATUS = {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    REJECTED: 'REJECTED'
};

const BOOKING_STATUS_LABELS = {
    [BOOKING_STATUS.PENDING]: 'Chờ xác nhận',
    [BOOKING_STATUS.CONFIRMED]: 'Đã xác nhận',
    [BOOKING_STATUS.COMPLETED]: 'Hoàn thành',
    [BOOKING_STATUS.CANCELLED]: 'Đã hủy',
    [BOOKING_STATUS.REJECTED]: 'Bị từ chối'
};

const SESSION_TYPE = {
    PERSONAL: 'PERSONAL',
    GROUP: 'GROUP',
    CLASS: 'CLASS',
    OTHER: 'OTHER'
};

const SESSION_TYPE_LABELS = {
    [SESSION_TYPE.PERSONAL]: 'Huấn luyện 1-1',
    [SESSION_TYPE.GROUP]: 'Huấn luyện nhóm',
    [SESSION_TYPE.CLASS]: 'Lớp tập thể',
    [SESSION_TYPE.OTHER]: 'Khác'
};

const PAYMENT_STATUS = {
    PENDING: 'PENDING',
    PAID: 'PAID',
    CANCELLED: 'CANCELLED'
};

const PAYMENT_STATUS_LABELS = {
    [PAYMENT_STATUS.PENDING]: 'Chờ thanh toán',
    [PAYMENT_STATUS.PAID]: 'Đã thanh toán',
    [PAYMENT_STATUS.CANCELLED]: 'Đã hủy'
};

const TRANSFER_TYPE = {
    NONE: 'NONE',
    TO_COLLEAGUE: 'TO_COLLEAGUE',
    TO_ANOTHER_DAY: 'TO_ANOTHER_DAY'
};

const TRANSFER_TYPE_LABELS = {
    [TRANSFER_TYPE.NONE]: 'Không chuyển',
    [TRANSFER_TYPE.TO_COLLEAGUE]: 'Chuyển PT khác',
    [TRANSFER_TYPE.TO_ANOTHER_DAY]: 'Dời sang ngày khác'
};

const TRANSFER_STATUS = {
    NONE: 'NONE',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
};

const TRANSFER_STATUS_LABELS = {
    [TRANSFER_STATUS.NONE]: 'Không có',
    [TRANSFER_STATUS.PENDING_APPROVAL]: 'Đang chờ duyệt',
    [TRANSFER_STATUS.APPROVED]: 'Đã duyệt',
    [TRANSFER_STATUS.REJECTED]: 'Bị từ chối'
};

const bookingSchemaV2 = new mongoose.Schema({
    bookingCode: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
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
    userPackageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserPackageV2',
        default: null
    },
    packageName: {
        type: String,
        default: ''
    },
    sessionType: {
        type: String,
        enum: Object.values(SESSION_TYPE),
        default: SESSION_TYPE.PERSONAL
    },
    disciplineName: {
        type: String,
        default: ''
    },
    trainerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StaffV2',
        default: null
    },
    trainerName: {
        type: String,
        default: ''
    },
    date: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    duration: {
        type: Number,
        default: 60
    },
    status: {
        type: String,
        enum: Object.values(BOOKING_STATUS),
        default: BOOKING_STATUS.PENDING
    },
    rejectionReason: {
        type: String,
        default: ''
    },
    note: {
        type: String,
        default: ''
    },
    price: {
        type: Number,
        default: 0
    },
    paymentStatus: {
        type: String,
        enum: Object.values(PAYMENT_STATUS),
        default: PAYMENT_STATUS.PENDING
    },
    paymentMethod: {
        type: String,
        default: ''
    },
    attendanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttendanceV2',
        default: null
    },
    transferType: {
        type: String,
        enum: Object.values(TRANSFER_TYPE),
        default: TRANSFER_TYPE.NONE
    },
    transferToTrainerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StaffV2',
        default: null
    },
    transferToTrainerName: {
        type: String,
        default: ''
    },
    transferredFromTrainerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StaffV2',
        default: null
    },
    transferredFromTrainerName: {
        type: String,
        default: ''
    },
    transferReason: {
        type: String,
        default: ''
    },
    transferNewDate: {
        type: Date,
        default: null
    },
    transferNewTime: {
        type: String,
        default: ''
    },
    transferStatus: {
        type: String,
        enum: Object.values(TRANSFER_STATUS),
        default: TRANSFER_STATUS.NONE
    },
    transferApprovedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StaffV2',
        default: null
    },
    transferApprovedAt: {
        type: Date,
        default: null
    },
    transferRejectionReason: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

bookingSchemaV2.virtual('dateLabel').get(function () {
    const d = new Date(this.date);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
});

bookingSchemaV2.virtual('timeLabel').get(function () {
    return `${this.startTime} - ${this.endTime}`;
});

bookingSchemaV2.virtual('statusLabel').get(function () {
    return BOOKING_STATUS_LABELS[this.status] || this.status;
});

bookingSchemaV2.virtual('sessionTypeLabel').get(function () {
    return SESSION_TYPE_LABELS[this.sessionType] || this.sessionType;
});

bookingSchemaV2.virtual('paymentStatusLabel').get(function () {
    return PAYMENT_STATUS_LABELS[this.paymentStatus] || this.paymentStatus;
});

bookingSchemaV2.virtual('transferTypeLabel').get(function () {
    return TRANSFER_TYPE_LABELS[this.transferType] || this.transferType;
});

bookingSchemaV2.virtual('transferStatusLabel').get(function () {
    return TRANSFER_STATUS_LABELS[this.transferStatus] || this.transferStatus;
});

bookingSchemaV2.virtual('hasTransfer').get(function () {
    return this.transferStatus !== TRANSFER_STATUS.NONE;
});

bookingSchemaV2.virtual('isOverdue').get(function () {
    if (this.status !== BOOKING_STATUS.PENDING && this.status !== BOOKING_STATUS.CONFIRMED) return false;
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return new Date(this.date) < startOfToday;
});

bookingSchemaV2.set('toJSON', { virtuals: true });
bookingSchemaV2.set('toObject', { virtuals: true });

module.exports = {
    BOOKING_STATUS,
    BOOKING_STATUS_LABELS,
    SESSION_TYPE,
    SESSION_TYPE_LABELS,
    PAYMENT_STATUS,
    PAYMENT_STATUS_LABELS,
    TRANSFER_TYPE,
    TRANSFER_TYPE_LABELS,
    TRANSFER_STATUS,
    TRANSFER_STATUS_LABELS,
    BookingV2: mongoose.models.BookingV2 || mongoose.model('BookingV2', bookingSchemaV2)
};
