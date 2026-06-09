import express from 'express';
import * as ProductController from '../controllers/productController.js';

const router = express.Router();

// Lấy tất cả sản phẩm
router.get('/', ProductController.getAllProducts);

// Lấy sản phẩm theo cơ sở (location)
router.get(
  '/location/:locationId',
  ProductController.getProductsByLocation
);

// Lấy sản phẩm theo ID
router.get('/:id', ProductController.getProductById);

// Thêm sản phẩm
router.post('/', ProductController.createProduct);

// Cập nhật sản phẩm
router.put('/:id', ProductController.updateProduct);

// Xóa sản phẩm
router.delete('/:id', ProductController.deleteProduct);

export default router;