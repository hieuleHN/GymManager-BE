const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const STAFF_ROLES = ['ADMIN', 'MANAGER', 'PT', 'RECEPTIONIST', 'STAFF'];

const STAFF_PERMISSIONS = [
    'staff',
    'customers',
    'equipment',
    'packages',
    'products',
    'services',
    'attendance',
    'statistics',
    'payment',
    'expenses',
    'training',
    'schedule',
    'tasks',
    'salary',
    'permissions',
    'clubs',
    'lockers',
    'wallet'
];

const workScheduleSchema = new mongoose.Schema({
    dayOfWeek: {
        type: Number,
        min: 0,
        max: 6,
        required: true,
        default: 0
    },
    startTime: {
        type: String,
        required: true,
        default: '08:00'
    },
    endTime: {
        type: String,
        required: true,
        default: '17:00'
    },
    note: {
        type: String,
        default: ''
    }
}, {
    _id: false
});

const staffSchemaV2 = new mongoose.Schema({
    account: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false
    },
    fullName: {
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
    phone: {
        type: String,
        required: true,
        trim: true
    },
    gender: {
        type: String,
        enum: ['Nam', 'Nữ', 'Khác'],
        default: 'Nam'
    },
    role: {
        type: String,
        enum: STAFF_ROLES,
        required: true,
        default: 'STAFF'
    },
    permissions: {
        type: [String],
        enum: STAFF_PERMISSIONS,
        default: []
    },
    workSchedule: {
        type: [workScheduleSchema],
        default: []
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    address: {
        type: String,
        default: ''
    },
    locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null
    },
    baseSalary: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'ACTIVE'
    }
}, {
    timestamps: true
});

staffSchemaV2.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

staffSchemaV2.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = {
    STAFF_ROLES,
    STAFF_PERMISSIONS,
    StaffV2: mongoose.models.StaffV2 || mongoose.model('StaffV2', staffSchemaV2)
};
