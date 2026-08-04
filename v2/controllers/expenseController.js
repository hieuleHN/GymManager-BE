const { ExpenseV2, EXPENSE_CATEGORY, EXPENSE_CATEGORY_LABELS } = require('../models/expenseModel');
const {
    filterExpense,
    summarizeExpense,
    formatPrice
} = require('../services/expenseService');

const getExpenseMeta = async (req, res) => {
    try {
        const categories = Object.values(EXPENSE_CATEGORY).map(key => ({ key, label: EXPENSE_CATEGORY_LABELS[key] }));
        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách loại chi phí V2 thành công',
            data: { categories }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh mục chi phí V2',
            error: error.message
        });
    }
};

const getExpenseList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const { search, category } = req.query;

        const allItems = await ExpenseV2.find().sort({ date: -1, createdAt: -1 });
        const filtered = allItems.filter(item => filterExpense(item, { search, category }));

        const skip = (page - 1) * limit;
        const data = filtered.slice(skip, skip + limit);

        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách chi phí V2 thành công',
            data,
            total: filtered.length,
            page,
            limit,
            totalPages: Math.ceil(filtered.length / limit)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy danh sách chi phí V2',
            error: error.message
        });
    }
};

const getExpenseById = async (req, res) => {
    try {
        const item = await ExpenseV2.findById(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khoản chi V2!'
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Lấy thông tin khoản chi V2 thành công',
            data: item
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy thông tin khoản chi V2',
            error: error.message
        });
    }
};

const createExpense = async (req, res) => {
    try {
        const { category, description, amount, date, note } = req.body;

        if (!Object.values(EXPENSE_CATEGORY).includes(category)) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn loại chi phí!' });
        }
        if (!description || !String(description).trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập mô tả chi phí!' });
        }
        const numAmount = Number(amount);
        if (amount === undefined || isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Số tiền phải lớn hơn 0!' });
        }
        if (!date) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn ngày!' });
        }

        const item = await ExpenseV2.create({
            category,
            description: String(description).trim(),
            amount: numAmount,
            date: new Date(date),
            note: note || ''
        });

        return res.status(201).json({
            success: true,
            message: `Thêm khoản chi "${item.description}" thành công`,
            data: item
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi thêm chi phí V2',
            error: error.message
        });
    }
};

const updateExpense = async (req, res) => {
    try {
        const item = await ExpenseV2.findById(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khoản chi V2!'
            });
        }

        const { category, description, amount, date, note } = req.body;

        if (category !== undefined && !Object.values(EXPENSE_CATEGORY).includes(category)) {
            return res.status(400).json({ success: false, message: 'Loại chi phí không hợp lệ!' });
        }
        if (description !== undefined && !String(description).trim()) {
            return res.status(400).json({ success: false, message: 'Mô tả không được để trống!' });
        }
        if (amount !== undefined) {
            const numAmount = Number(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
                return res.status(400).json({ success: false, message: 'Số tiền phải lớn hơn 0!' });
            }
            item.amount = numAmount;
        }

        if (category !== undefined) item.category = category;
        if (description !== undefined) item.description = String(description).trim();
        if (date !== undefined) item.date = new Date(date);
        if (note !== undefined) item.note = note;

        const saved = await item.save();
        return res.status(200).json({
            success: true,
            message: 'Cập nhật chi phí V2 thành công',
            data: saved
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi cập nhật chi phí V2',
            error: error.message
        });
    }
};

const deleteExpense = async (req, res) => {
    try {
        const item = await ExpenseV2.findByIdAndDelete(req.params.id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khoản chi V2!'
            });
        }
        return res.status(200).json({
            success: true,
            message: `Xóa khoản chi "${item.description}" thành công`
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xóa chi phí V2',
            error: error.message
        });
    }
};

const getExpenseStats = async (req, res) => {
    try {
        const allItems = await ExpenseV2.find();
        const summary = summarizeExpense(allItems);

        return res.status(200).json({
            success: true,
            message: 'Lấy thống kê chi phí V2 thành công',
            data: {
                ...summary,
                categories: Object.values(EXPENSE_CATEGORY).map(key => ({
                    key,
                    label: EXPENSE_CATEGORY_LABELS[key],
                    amount: summary.amountByCategory[key] || 0,
                    formattedAmount: formatPrice(summary.amountByCategory[key] || 0)
                })),
                generatedAt: new Date()
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi lấy thống kê chi phí V2',
            error: error.message
        });
    }
};

module.exports = {
    formatPrice,
    getExpenseMeta,
    getExpenseList,
    getExpenseById,
    createExpense,
    updateExpense,
    deleteExpense,
    getExpenseStats
};
