const mongoose = require('mongoose');

const lockerSchemaV2 = new mongoose.Schema({
    lockerNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    zone: {
        type: String,
        enum: ['NAM', 'NU', 'VIP'],
        default: 'NAM'
    },
    status: {
        type: String,
        enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'],
        default: 'AVAILABLE'
    },
    currentCustomer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        default: null
    },
    assignedAt: {
        type: Date,
        default: null
    },
    note: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.models.LockerV2 || mongoose.model('LockerV2', lockerSchemaV2);