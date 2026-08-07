const mongoose = require('mongoose');

const STOCK_STATUS = {
    IN_STOCK: 'IN_STOCK',
    LOW_STOCK: 'LOW_STOCK',
    OUT_OF_STOCK: 'OUT_OF_STOCK'
};

const productSchemaV2 = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    costPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    quantity: {
        type: Number,
        default: 0,
        min: 0
    },
    sold: {
        type: Number,
        default: 0,
        min: 0
    },
    lowStockThreshold: {
        type: Number,
        default: 5,
        min: 0
    },
    description: {
        type: String,
        default: ''
    },
    image: {
        type: String,
        default: ''
    },
    importDate: {
        type: Date,
        default: Date.now
    },
    expiryDate: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'ACTIVE'
    }
}, {
    timestamps: true
});

productSchemaV2.virtual('stockStatus').get(function () {
    if (!this.quantity || this.quantity <= 0) return STOCK_STATUS.OUT_OF_STOCK;
    if (this.quantity <= (this.lowStockThreshold || 0)) return STOCK_STATUS.LOW_STOCK;
    return STOCK_STATUS.IN_STOCK;
});

productSchemaV2.set('toJSON', { virtuals: true });
productSchemaV2.set('toObject', { virtuals: true });

const productReturnSchemaV2 = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductV2',
        default: null
    },
    productName: {
        type: String,
        required: true,
        trim: true
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    returnDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = {
    STOCK_STATUS,
    ProductV2: mongoose.models.ProductV2 || mongoose.model('ProductV2', productSchemaV2),
    ProductReturnV2: mongoose.models.ProductReturnV2 || mongoose.model('ProductReturnV2', productReturnSchemaV2)
};
