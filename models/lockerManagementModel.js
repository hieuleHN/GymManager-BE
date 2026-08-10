import mongoose from "mongoose";

export const LOCKER_STATUS = {
    AVAILABLE: "AVAILABLE",
    OCCUPIED: "OCCUPIED",
    MAINTENANCE: "MAINTENANCE",
    AWAIT_KEY_RETURN: "AWAIT_KEY_RETURN"
};

const lockerManagementSchema = new mongoose.Schema({
    lockerNumber: {
        type: String,
        required: true,
        trim: true
    },
    locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Location",
        default: null
    },
    prefix: {
        type: String,
        required: true,
        trim: true,
        default: "LK"
    },
    zone: {
        type: String,
        enum: ["NAM", "NU", "VIP"],
        default: "NAM"
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
        enum: ["MEMBER", "STAFF", null],
        default: null
    },
    assignedName: {
        type: String,
        default: ""
    },
    assignedPhone: {
        type: String,
        default: ""
    },
    assignedAt: {
        type: Date,
        default: null
    },
    rentalDays: {
        type: Number,
        default: 0
    },
    rentedAt: {
        type: Date,
        default: null
    },
    note: {
        type: String,
        default: ""
    },
    maintenanceType: {
        type: String,
        default: ""
    },
    maintenanceDescription: {
        type: String,
        default: ""
    },
    maintenanceImage: {
        type: String,
        default: ""
    },
    maintenanceAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

lockerManagementSchema.virtual("statusLabel").get(function () {
    const map = {
        AVAILABLE: "Trống",
        OCCUPIED: "Đang sử dụng",
        MAINTENANCE: "Bảo trì",
        AWAIT_KEY_RETURN: "Chờ trả chìa khoá"
    };
    return map[this.status] || this.status;
});

lockerManagementSchema.set("toJSON", { virtuals: true });
lockerManagementSchema.set("toObject", { virtuals: true });

// Mã tủ chỉ cần duy nhất trong phạm vi từng phòng tập (nhiều phòng có thể có LK-001)
lockerManagementSchema.index({ locationId: 1, lockerNumber: 1 }, { unique: true });

// Giữ nguyên tên model "LockerV2" để không đổi collection dữ liệu đang có (lockerv2s)
const LockerV2 = mongoose.models.LockerV2 || mongoose.model("LockerV2", lockerManagementSchema);

// Đồng bộ index: gỡ index unique cũ trên lockerNumber, tạo index duy nhất theo (locationId, lockerNumber)
LockerV2.syncIndexes().catch(() => {});

export { LockerV2 };
