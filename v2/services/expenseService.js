const { ExpenseV2, EXPENSE_CATEGORY, EXPENSE_CATEGORY_LABELS } = require('../models/expenseModel');

const toDateKey = (dateInput) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
};

const formatDateLabel = (dateInput) => {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatPrice = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('vi-VN');
};

const getMonthRange = (offset = 0) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
    return { start, end };
};

const filterExpense = (item, { search, category } = {}) => {
    if (category && category !== 'ALL' && item.category !== category) return false;
    if (search) {
        const keyword = String(search).trim().toLowerCase();
        if (!keyword) return true;
        const matchDesc = (item.description || '').toLowerCase().includes(keyword);
        const matchNote = (item.note || '').toLowerCase().includes(keyword);
        const matchAmount = String(item.amount || '').includes(keyword);
        if (!matchDesc && !matchNote && !matchAmount) return false;
    }
    return true;
};

const summarizeExpense = (list) => {
    const total = list.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const byCategory = {};
    Object.values(EXPENSE_CATEGORY).forEach(cat => {
        byCategory[cat] = list
            .filter(item => item.category === cat)
            .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    });
    const { start, end } = getMonthRange(0);
    const thisMonth = list
        .filter(item => {
            const d = new Date(item.date);
            return d >= start && d <= end;
        })
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    return {
        totalCount: list.length,
        totalAmount: total,
        thisMonthAmount: thisMonth,
        categoryCounts: buildCounts(list, item => item.category),
        amountByCategory: byCategory
    };
};

const buildCounts = (list, keyFn) => {
    const counts = {};
    list.forEach(item => {
        const key = keyFn(item);
        counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
};

module.exports = {
    EXPENSE_CATEGORY,
    EXPENSE_CATEGORY_LABELS,
    toDateKey,
    formatDateLabel,
    formatPrice,
    getMonthRange,
    filterExpense,
    summarizeExpense,
    buildCounts
};
