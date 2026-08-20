import mongoose from "mongoose";

const checkInSchema = new mongoose.Schema({

    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: true
    },

    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        required: false,
        default: null
    },

    userPackageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserPackage",
        required: true
    },

    locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Location",
        default: null
    },

    // Lưu hình thức điểm danh (FACE_ID hoặc QR_CODE)
    method: {
        type: String,
        enum: ["QR_CODE", "FACE_ID", "MANUAL"],
        default: "QR_CODE"
    },

    qrToken: {
        type: String,
        default: ""
    },

    checkInTime: {
        type: Date,
        default: Date.now
    },

    checkOutTime: {
        type: Date,
        default: null
    },

    lockerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LockerV2",
        default: null
    },

    lockerNumber: {
        type: String,
        default: ""
    },

    status: {
        type: String,
        enum: [
            "success",
            "checked-out",
            "expired",
            "blocked"
        ],
        default: "success"
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

export default mongoose.model(
    "CheckIn",
    checkInSchema
);