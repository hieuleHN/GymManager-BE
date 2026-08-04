const { AttendanceV2, CHECKIN_STATUS } = require('../models/attendanceModel');
const { UserPackageV2, MEMBERSHIP_STATUS, PAYMENT_STATUS } = require('../models/userPackageModel');
const { computeStatus } = require('./membershipService');

// Kiểm tra số điện thoại Việt Nam: bắt đầu bằng 0 và theo sau là 9-10 chữ số
const validateVietnamesePhone = (phone) => {
    if (!phone) return false;
    return /^0\d{9,10}$/.test(String(phone).trim());
};

const getDayRange = (dateInput) => {
    const date = dateInput ? new Date(dateInput) : new Date();
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    return { start, end };
};

const toDateKey = (dateInput) => {
    const date = new Date(dateInput);
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
};

const formatTimeLabel = (dateInput) => {
    const d = new Date(dateInput);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
};

const hasCheckedInToday = async (customerPhone, dateInput) => {
    const { start, end } = getDayRange(dateInput);
    return AttendanceV2.exists({
        customerPhone,
        checkInTime: { $gte: start, $lte: end },
        status: { $in: [CHECKIN_STATUS.SUCCESS, CHECKIN_STATUS.MANUAL] }
    });
};

// Lấy danh sách gói membership đang còn hiệu lực (ACTIVE/EXPIRING_SOON),
// trạng thái được tính theo thời gian thực để tránh dữ liệu cũ
const findActiveMemberships = async (filter = {}) => {
    const query = {
        status: { $ne: MEMBERSHIP_STATUS.CANCELLED },
        paymentStatus: PAYMENT_STATUS.PAID,
        ...filter
    };
    const candidates = await UserPackageV2.find(query);
    return candidates.filter(membership => {
        const status = computeStatus(membership);
        return status === MEMBERSHIP_STATUS.ACTIVE || status === MEMBERSHIP_STATUS.EXPIRING_SOON;
    });
};

// Lấy gói hiệu lực gần hết hạn nhất của một hội viên
const findActiveMembership = async ({ customerId, customerPhone } = {}) => {
    const filter = {};
    if (customerId) filter.customerId = customerId;
    if (customerPhone) filter.customerPhone = customerPhone;
    const memberships = await findActiveMemberships(filter);
    memberships.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
    return memberships[0] || null;
};

// Đếm số gói membership đang còn hiệu lực
const countActiveMembers = async () => {
    const memberships = await findActiveMemberships();
    return memberships.length;
};

const summarizeAttendance = (records, activeMembersCount = 0) => {
    const total = records.length;
    const methodCounts = {};
    records.forEach(record => {
        const method = record.method || 'MANUAL';
        methodCounts[method] = (methodCounts[method] || 0) + 1;
    });
    const notCheckedIn = Math.max(0, activeMembersCount - total);
    const rate = activeMembersCount > 0 ? Math.round((total / activeMembersCount) * 100) : 0;

    return {
        total,
        activeMembersCount,
        notCheckedIn,
        rate,
        methodCounts
    };
};

const buildTrend = (records, days) => {
    const dayMap = {};
    records.forEach(record => {
        const key = toDateKey(record.checkInTime);
        dayMap[key] = (dayMap[key] || 0) + 1;
    });

    const trend = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i -= 1) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = toDateKey(day);
        trend.push({
            date: key,
            label: day.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
            count: dayMap[key] || 0
        });
    }
    return trend;
};

const filterAttendance = (record, { search, date, status }) => {
    if (status && status !== 'ALL' && record.status !== status) return false;
    if (date) {
        if (toDateKey(record.checkInTime) !== date) return false;
    }
    if (search) {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return true;
        const matchName = (record.customerName || '').toLowerCase().includes(keyword);
        const matchPhone = (record.customerPhone || '').toLowerCase().includes(keyword);
        const matchPackage = (record.packageName || '').toLowerCase().includes(keyword);
        if (!matchName && !matchPhone && !matchPackage) return false;
    }
    return true;
};

module.exports = {
    CHECKIN_STATUS,
    validateVietnamesePhone,
    getDayRange,
    toDateKey,
    formatTimeLabel,
    hasCheckedInToday,
    findActiveMemberships,
    findActiveMembership,
    countActiveMembers,
    summarizeAttendance,
    buildTrend,
    filterAttendance
};
