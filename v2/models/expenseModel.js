const mongoose = require('mongoose');

const EXPENSE_CATEGORY = {
    EQUIPMENT: 'EQUIPMENT',
    UTILITIES: 'UTILITIES',
    TAX: 'TAX',
    OTHER: 'OTHER'
};

const EXPENSE_CATEGORY_LABELS = {
    [EXPENSE_CATEGORY.EQUIPMENT]: 'Sửa thiết bị',
    [EXPENSE_CATEGORY.UTILITIES]: 'Điện, nước, internet',
    [EXPENSE_CATEGORY.TAX]: 'Thuế',
    [EXPENSE_CATEGORY.OTHER]: 'Khác'
};

const expenseSchemaV2 = new mongoose.Schema({
    category: {
        type: String,
        enum: Object.values(EXPENSE_CATEGORY),
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    date: {
        type: Date,
        required: true
    },
    note: {
        type: String,
        default: ''
    },
    locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null
    }
}, {
    timestamps: true
});

expenseSchemaV2.virtual('categoryLabel').get(function () {
    return EXPENSE_CATEGORY_LABELS[this.category] || this.category;
});

expenseSchemaV2.virtual('dateLabel').get(function () {
    if (!this.date) return '';
    const d = new Date(this.date);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
});

expenseSchemaV2.virtual('amountLabel').get(function () {
    return (Number(this.amount) || 0).toLocaleString('vi-VN');
});

expenseSchemaV2.set('toJSON', { virtuals: true });
expenseSchemaV2.set('toObject', { virtuals: true });

module.exports = {
    EXPENSE_CATEGORY,
    EXPENSE_CATEGORY_LABELS,
    ExpenseV2: mongoose.models.ExpenseV2 || mongoose.model('ExpenseV2', expenseSchemaV2)
};
