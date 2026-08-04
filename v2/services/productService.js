const { ProductV2, STOCK_STATUS } = require('../models/productModel');

const getStockStatus = (product) => {
    if (!product) return STOCK_STATUS.OUT_OF_STOCK;
    const quantity = product.quantity || 0;
    const threshold = product.lowStockThreshold || 0;
    if (quantity <= 0) return STOCK_STATUS.OUT_OF_STOCK;
    if (quantity <= threshold) return STOCK_STATUS.LOW_STOCK;
    return STOCK_STATUS.IN_STOCK;
};

const checkStock = (product, quantity) => {
    if (!product) {
        return { ok: false, message: 'Không tìm thấy sản phẩm!' };
    }
    const qty = parseInt(quantity) || 0;
    if (qty < 1) {
        return { ok: false, message: 'Số lượng phải lớn hơn 0!' };
    }
    const currentStock = product.quantity || 0;
    if (currentStock < qty) {
        return {
            ok: false,
            message: `Không đủ tồn kho! Hiện chỉ còn ${currentStock} sản phẩm "${product.name}"`
        };
    }
    return { ok: true, qty, currentStock };
};

const deductStock = async (productId, quantity) => {
    const product = await ProductV2.findById(productId);
    const checked = checkStock(product, quantity);
    if (!checked.ok) return { ok: false, message: checked.message };

    const qty = checked.qty;
    const updated = await ProductV2.findByIdAndUpdate(
        productId,
        {
            $inc: { quantity: -qty, sold: qty }
        },
        { new: true }
    );

    if (!updated) return { ok: false, message: 'Không tìm thấy sản phẩm!' };
    return {
        ok: true,
        message: `Đã ghi nhận bán ${qty} sản phẩm "${updated.name}". Tồn kho còn lại: ${updated.quantity}`,
        data: updated
    };
};

const restoreStock = async (productId, quantity) => {
    const qty = parseInt(quantity) || 0;
    if (qty < 1) {
        return { ok: false, message: 'Số lượng phải lớn hơn 0!' };
    }

    const product = await ProductV2.findById(productId);
    if (!product) return { ok: false, message: 'Không tìm thấy sản phẩm!' };

    const updated = await ProductV2.findByIdAndUpdate(
        productId,
        {
            $inc: { quantity: qty, sold: -qty }
        },
        { new: true }
    );

    return {
        ok: true,
        message: `Đã hoàn trả ${qty} sản phẩm "${updated.name}". Tồn kho hiện tại: ${updated.quantity}`,
        data: updated
    };
};

const addStock = async (productId, quantity) => {
    const qty = parseInt(quantity) || 0;
    if (qty < 1) {
        return { ok: false, message: 'Số lượng nhập phải lớn hơn 0!' };
    }

    const product = await ProductV2.findById(productId);
    if (!product) return { ok: false, message: 'Không tìm thấy sản phẩm!' };

    const updated = await ProductV2.findByIdAndUpdate(
        productId,
        { $inc: { quantity: qty } },
        { new: true }
    );

    return {
        ok: true,
        message: `Đã nhập thêm ${qty} sản phẩm "${updated.name}". Tồn kho hiện tại: ${updated.quantity}`,
        data: updated
    };
};

const summarizeProducts = async () => {
    const products = await ProductV2.find();
    let totalStock = 0;
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach(product => {
        totalStock += product.quantity || 0;
        totalValue += (product.price || 0) * (product.quantity || 0);
        const status = getStockStatus(product);
        if (status === STOCK_STATUS.LOW_STOCK) lowStockCount += 1;
        if (status === STOCK_STATUS.OUT_OF_STOCK) outOfStockCount += 1;
    });

    return {
        total: products.length,
        totalStock,
        totalValue,
        lowStockCount,
        outOfStockCount
    };
};

const filterProductsByStock = (product, stockFilter) => {
    if (!stockFilter || stockFilter === 'ALL') return true;
    return getStockStatus(product) === stockFilter;
};

module.exports = {
    STOCK_STATUS,
    getStockStatus,
    checkStock,
    deductStock,
    restoreStock,
    addStock,
    summarizeProducts,
    filterProductsByStock
};
