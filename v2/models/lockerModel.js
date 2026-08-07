const mongoose = require('mongoose');

const LOCKER_STATUS = {
    AVAILABLE: 'AVAILABLE',
    OCCUPIED: 'OCCUPIED',
    MAINTENANCE: 'MAINTENANCE'
};

const lockerSchemaV2 = new mongoose.Schema({
    lockerNumber: {
        type: String,
        required: true,
        trim: true
    },
    locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null
    },
    prefix: {
        type: String,
        required: true,
        trim: true,
        default: 'LK'
    },
    zone: {
        type: String,
        enum: ['NAM', 'NU', 'VIP'],
        default: 'NAM'
    },
    status: {
        type: String,
        enum: Object.values(LOCKER_STATUS),
        default: LOCKER_STATUS.AVAILABLE
    },
    // Trạng thái trước khi vào bảo trì, dùng để hoàn tất bảo trì -> quay về đúng trạng thái cũ
    previousStatus: {
        type: String,
        enum: [...Object.values(LOCKER_STATUS), null],
        default: null
    },
    assignedType: {
        type: String,
        enum: ['MEMBER', 'STAFF', null],
        default: null
    },
    assignedName: {
        type: String,
        default: ''
    },
    assignedPhone: {
        type: String,
        default: ''
    },
    assignedAt: {
        type: Date,
        default: null
    },
    note: {
        type: String,
        default: ''
    },
    maintenanceType: {
        type: String,
        default: ''
    },
    maintenanceDescription: {
        type: String,
        default: ''
    },
    maintenanceImage: {
        type: String,
        default: ''
    },
    maintenanceAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

lockerSchemaV2.virtual('statusLabel').get(function () {
    const map = {
        AVAILABLE: 'Trống',
        OCCUPIED: 'Đang sử dụng',
        MAINTENANCE: 'Bảo trì'
    };
    return map[this.status] || this.status;
});

lockerSchemaV2.set('toJSON', { virtuals: true });
lockerSchemaV2.set('toObject', { virtuals: true });

// Mã tủ chỉ cần duy nhất trong phạm vi từng phòng tập (nhiều phòng có thể có LK-001)
lockerSchemaV2.index({ locationId: 1, lockerNumber: 1 }, { unique: true });

const LockerV2 = mongoose.models.LockerV2 || mongoose.model('LockerV2', lockerSchemaV2);

// Đồng bộ index: gỡ index unique cũ trên lockerNumber, tạo index duy nhất theo (locationId, lockerNumber)
LockerV2.syncIndexes().catch(() => {});

module.exports = {
    LOCKER_STATUS,
    LockerV2
};
