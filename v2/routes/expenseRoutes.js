const express = require('express');
const router = express.Router();
const {
    getExpenseMeta,
    getExpenseList,
    getExpenseById,
    createExpense,
    updateExpense,
    deleteExpense,
    getExpenseStats
} = require('../controllers/expenseController');

// GET /api/v2/expenses/meta - Danh sách loại chi phí
router.get('/meta', getExpenseMeta);

// GET /api/v2/expenses/stats - Thống kê chi phí (tổng tiền, theo loại, tháng này)
router.get('/stats', getExpenseStats);

// GET /api/v2/expenses - Danh sách chi phí (lọc theo tìm kiếm/loại, phân trang)
router.get('/', getExpenseList);

// POST /api/v2/expenses - Thêm khoản chi mới
router.post('/', createExpense);

// GET /api/v2/expenses/:id - Chi tiết khoản chi
router.get('/:id', getExpenseById);

// PUT /api/v2/expenses/:id - Cập nhật khoản chi
router.put('/:id', updateExpense);

// DELETE /api/v2/expenses/:id - Xóa khoản chi
router.delete('/:id', deleteExpense);

module.exports = router;
