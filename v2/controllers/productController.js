const { ProductV2, ProductReturnV2 } = require('../models/productModel');
const {
    getStockStatus,
    deductStock,
    restoreStock,
    addStock,
    summarizeProducts,
    filterProductsByStock
} = require('../services/productService');

const formatPrice = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('vi-VN');
};

const getProductList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const { search, status, stock } = req.query;

        const filter = {};
        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            filter.$or = [{ name: regex }, { description: regex }];
        }
        if (status) filter.status = status;

        const skip = (page - 1) * limit;
        const allProducts = await ProductV2.find(filter).sort({ createdAt: -1 });
        const total = allProducts.length;

        const filtered = allProducts.filter(product => filterProductsByStock(product, stock));
        const data = filtered.slice(skip, skip + limit);

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách sản phẩm V2 thành công',
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(filtered.length / limit)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách sản phẩm V2',
            error: error.message
        });
    }
};

const getProductSummary = async (req, res) => {
    try {
        const summary = await summarizeProducts();
        return res.status(200).json({
            success: true,
            message: 'Lấy tổng quan kho hàng V2 thành công',
            data: summary
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy tổng quan kho hàng V2',
            error: error.message
        });
    }
};

const getProductById = async (req, res) => {
    try {
        const product = await ProductV2.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sản phẩm V2!'
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Lấy thông tin sản phẩm V2 thành công',
            data: product
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy thông tin sản phẩm V2',
            error: error.message
        });
    }
};

const createProduct = async (req, res) => {
    try {
        const { name, price, costPrice, quantity, lowStockThreshold, description, image, importDate, expiryDate } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập tên sản phẩm!'
            });
        }
        if (price === undefined || Number(price) < 0) {
            return res.status(400).json({
                success: false,
                message: 'Giá bán không hợp lệ!'
            });
        }

        const product = await ProductV2.create({
            name: name.trim(),
            price: Number(price),
            costPrice: Number(costPrice) || 0,
            quantity: Number(quantity) || 0,
            lowStockThreshold: lowStockThreshold !== undefined ? Number(lowStockThreshold) : 5,
            description: description || '',
            image: image || '',
            importDate: importDate || new Date(),
            expiryDate: expiryDate || null,
            status: 'ACTIVE'
        });

        return res.status(201).json({
            success: true,
            message: 'Thêm sản phẩm V2 thành công',
            data: product
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi thêm sản phẩm V2',
            error: error.message
        });
    }
};

const updateProduct = async (req, res) => {
    try {
        const product = await ProductV2.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sản phẩm V2!'
            });
        }

        const { name, price, costPrice, quantity, lowStockThreshold, description, image, importDate, expiryDate, status } = req.body;

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Tên sản phẩm không được để trống!'
                });
            }
            product.name = name.trim();
        }
        if (price !== undefined && Number(price) >= 0) product.price = Number(price);
        if (costPrice !== undefined) product.costPrice = Number(costPrice);
        if (quantity !== undefined && Number(quantity) >= 0) product.quantity = Number(quantity);
        if (lowStockThreshold !== undefined) product.lowStockThreshold = Number(lowStockThreshold);
        if (description !== undefined) product.description = description;
        if (image !== undefined) product.image = image;
        if (importDate !== undefined) product.importDate = importDate;
        if (expiryDate !== undefined) product.expiryDate = expiryDate;
        if (status !== undefined && ['ACTIVE', 'INACTIVE'].includes(status)) product.status = status;

        const saved = await product.save();
        return res.status(200).json({
            success: true,
            message: 'Cập nhật sản phẩm V2 thành công',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi cập nhật sản phẩm V2',
            error: error.message
        });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const product = await ProductV2.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sản phẩm V2!'
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Xóa sản phẩm V2 thành công'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xóa sản phẩm V2',
            error: error.message
        });
    }
};

const sellProduct = async (req, res) => {
    try {
        const { quantity } = req.body;
        const result = await deductStock(req.params.id, quantity);
        if (!result.ok) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }
        return res.status(200).json({
            success: true,
            message: result.message,
            data: result.data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi bán sản phẩm V2',
            error: error.message
        });
    }
};

const restockProduct = async (req, res) => {
    try {
        const { quantity } = req.body;
        const result = await addStock(req.params.id, quantity);
        if (!result.ok) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }
        return res.status(200).json({
            success: true,
            message: result.message,
            data: result.data
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi nhập kho sản phẩm V2',
            error: error.message
        });
    }
};

const getReturnList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            ProductReturnV2.find().populate('productId', 'name price').sort({ createdAt: -1 }).skip(skip).limit(limit),
            ProductReturnV2.countDocuments()
        ]);

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách phiếu trả hàng V2 thành công',
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách phiếu trả hàng V2',
            error: error.message
        });
    }
};

const createReturn = async (req, res) => {
    try {
        const { productId, productName, reason, quantity } = req.body;

        if (!productId && !productName) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn sản phẩm trả hàng!'
            });
        }
        if (!reason || !reason.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập lý do trả hàng!'
            });
        }
        if (!quantity || Number(quantity) < 1) {
            return res.status(400).json({
                success: false,
                message: 'Số lượng trả hàng phải lớn hơn 0!'
            });
        }

        let finalProductId = productId || null;
        let finalProductName = productName;
        if (productId) {
            const product = await ProductV2.findById(productId);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy sản phẩm cần trả!'
                });
            }
            finalProductName = product.name;
        }

        const restock = await restoreStock(finalProductId, quantity);
        if (!restock.ok) {
            return res.status(400).json({
                success: false,
                message: restock.message
            });
        }

        const productReturn = await ProductReturnV2.create({
            productId: finalProductId,
            productName: finalProductName,
            reason: reason.trim(),
            quantity: Number(quantity)
        });

        return res.status(201).json({
            success: true,
            message: 'Ghi nhận trả hàng V2 thành công. ' + restock.message,
            data: productReturn
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi ghi nhận trả hàng V2',
            error: error.message
        });
    }
};

const deleteReturn = async (req, res) => {
    try {
        const productReturn = await ProductReturnV2.findByIdAndDelete(req.params.id);
        if (!productReturn) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phiếu trả hàng V2!'
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Xóa phiếu trả hàng V2 thành công'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xóa phiếu trả hàng V2',
            error: error.message
        });
    }
};

module.exports = {
    formatPrice,
    getStockStatus,
    getProductList,
    getProductSummary,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    sellProduct,
    restockProduct,
    getReturnList,
    createReturn,
    deleteReturn
};
