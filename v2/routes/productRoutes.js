const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/productController');

// GET /api/v2/products/summary - Tổng quan kho hàng
router.get('/summary', getProductSummary);

// GET /api/v2/products/returns - Danh sách phiếu trả hàng
router.get('/returns', getReturnList);

// POST /api/v2/products/returns - Ghi nhận trả hàng (hoàn lại tồn kho)
router.post('/returns', createReturn);

// DELETE /api/v2/products/returns/:id - Xóa phiếu trả hàng
router.delete('/returns/:id', deleteReturn);

// GET /api/v2/products - Danh sách sản phẩm
router.get('/', getProductList);

// POST /api/v2/products - Thêm sản phẩm mới
router.post('/', createProduct);

// GET /api/v2/products/:id - Chi tiết sản phẩm
router.get('/:id', getProductById);

// PUT /api/v2/products/:id - Cập nhật sản phẩm
router.put('/:id', updateProduct);

// DELETE /api/v2/products/:id - Xóa sản phẩm
router.delete('/:id', deleteProduct);

// POST /api/v2/products/:id/sell - Ghi nhận bán (trừ tồn kho)
router.post('/:id/sell', sellProduct);

// POST /api/v2/products/:id/restock - Nhập thêm hàng (cộng tồn kho)
router.post('/:id/restock', restockProduct);

module.exports = router;
