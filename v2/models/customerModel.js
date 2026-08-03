const mongoose = require('mongoose');

const customerSchemaV2 = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    phoneNumber: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: ''
    },
    membershipPackage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package',
        default: null
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    expiryDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED'],
        default: 'ACTIVE'
    },
    assignedLocker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LockerV2',
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.models.CustomerV2 || mongoose.model('CustomerV2', customerSchemaV2);