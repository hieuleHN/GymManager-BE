
const mongoose = require('mongoose');

const CHECKIN_STATUS = {
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    MANUAL: 'MANUAL'
};

const CHECKIN_METHOD = {
    QR: 'QR',
    MANUAL: 'MANUAL'
};

const CHECKIN_STATUS_LABELS = {
    [CHECKIN_STATUS.SUCCESS]: 'Điểm danh thành công',
    [CHECKIN_STATUS.FAILED]: 'Không hợp lệ',
    [CHECKIN_STATUS.MANUAL]: 'Điểm danh thủ công'
};

const CHECKIN_METHOD_LABELS = {
    [CHECKIN_METHOD.QR]: 'Quét QR',
    [CHECKIN_METHOD.MANUAL]: 'Nhập tay'
};

const attendanceSchemaV2 = new mongoose.Schema({
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
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StaffV2',
        default: null
    },
    staffName: {
        type: String,
        default: ''
    },
    checkInTime: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: Object.values(CHECKIN_STATUS),
        default: CHECKIN_STATUS.SUCCESS
    },
    method: {
        type: String,
        enum: Object.values(CHECKIN_METHOD),
        default: CHECKIN_METHOD.MANUAL
    },
    note: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

attendanceSchemaV2.virtual('dateLabel').get(function () {
    const d = new Date(this.checkInTime);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
});

attendanceSchemaV2.virtual('timeLabel').get(function () {
    const d = new Date(this.checkInTime);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
});

attendanceSchemaV2.virtual('statusLabel').get(function () {
    return CHECKIN_STATUS_LABELS[this.status] || this.status;
});

attendanceSchemaV2.virtual('methodLabel').get(function () {
    return CHECKIN_METHOD_LABELS[this.method] || this.method;
});

attendanceSchemaV2.set('toJSON', { virtuals: true });
attendanceSchemaV2.set('toObject', { virtuals: true });

module.exports = {
    CHECKIN_STATUS,
    CHECKIN_STATUS_LABELS,
    CHECKIN_METHOD,
    CHECKIN_METHOD_LABELS,
    AttendanceV2: mongoose.models.AttendanceV2 || mongoose.model('AttendanceV2', attendanceSchemaV2)

};
