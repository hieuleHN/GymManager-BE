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

    qrToken: {
        type: String,
        default: ""
    },

    checkInTime: {
        type: Date,
        default: Date.now
    },

    status: {
        type: String,
        enum: [
            "success",
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