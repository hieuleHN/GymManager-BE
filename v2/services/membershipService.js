const {
    UserPackageV2,
    MEMBERSHIP_STATUS,
    PAYMENT_STATUS,
    EXPIRING_SOON_DAYS
} = require('../models/userPackageModel');

// Kiểm tra số điện thoại Việt Nam: bắt đầu bằng 0 và theo sau là 9-10 chữ số
const validateVietnamesePhone = (phone) => {
    if (!phone) return false;
    return /^0\d{9,10}$/.test(String(phone).trim());
};

const getRemainingDays = (membership, now = new Date()) => {
    if (!membership || !membership.endDate) return 0;
    const end = new Date(membership.endDate);
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const computeStatus = (membership, now = new Date()) => {
    if (!membership) return MEMBERSHIP_STATUS.EXPIRED;
    if (membership.status === MEMBERSHIP_STATUS.CANCELLED) return MEMBERSHIP_STATUS.CANCELLED;

    const remaining = getRemainingDays(membership, now);
    if (remaining <= 0) return MEMBERSHIP_STATUS.EXPIRED;
    if (remaining <= EXPIRING_SOON_DAYS) return MEMBERSHIP_STATUS.EXPIRING_SOON;
    return MEMBERSHIP_STATUS.ACTIVE;
};

const isActive = (membership, now = new Date()) => {
    const status = computeStatus(membership, now);
    return status === MEMBERSHIP_STATUS.ACTIVE || status === MEMBERSHIP_STATUS.EXPIRING_SOON;
};

const computeEndDate = (startDate, durationMonths) => {
    const months = parseInt(durationMonths) || 1;
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + months);
    end.setSeconds(-1);
    return end;
};

const buildMembershipCode = (membership) => {
    const id = String(membership._id || '').slice(-6).toUpperCase();
    return `MBR-${id || Math.floor(Math.random() * 9000 + 1000)}`;
};

const summarizeMemberships = async () => {
    const memberships = await UserPackageV2.find();
    let activeCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;
    let cancelledCount = 0;
    let pendingPaymentCount = 0;
    let totalRevenue = 0;
    const customerMap = {};

    memberships.forEach(membership => {
        const status = computeStatus(membership);
        if (status === MEMBERSHIP_STATUS.ACTIVE) activeCount += 1;
        if (status === MEMBERSHIP_STATUS.EXPIRING_SOON) expiringCount += 1;
        if (status === MEMBERSHIP_STATUS.EXPIRED) expiredCount += 1;
        if (status === MEMBERSHIP_STATUS.CANCELLED) cancelledCount += 1;
        if (membership.paymentStatus === PAYMENT_STATUS.PENDING) pendingPaymentCount += 1;
        if (membership.paymentStatus === PAYMENT_STATUS.PAID) totalRevenue += membership.totalPrice || 0;
        const phone = membership.customerPhone || 'unknown';
        customerMap[phone] = true;
    });

    return {
        total: memberships.length,
        activeCount,
        expiringCount,
        expiredCount,
        cancelledCount,
        pendingPaymentCount,
        totalRevenue,
        totalCustomers: Object.keys(customerMap).length
    };
};

const filterMembership = (membership, { search, status, paymentStatus }) => {
    if (status && status !== 'ALL' && computeStatus(membership) !== status) return false;
    if (paymentStatus && paymentStatus !== 'ALL' && membership.paymentStatus !== paymentStatus) return false;
    if (search) {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return true;
        const matchName = (membership.customerName || '').toLowerCase().includes(keyword);
        const matchPhone = (membership.customerPhone || '').toLowerCase().includes(keyword);
        const matchPackage = (membership.packageName || '').toLowerCase().includes(keyword);
        if (!matchName && !matchPhone && !matchPackage) return false;
    }
    return true;
};

const refreshStatuses = async () => {
    const memberships = await UserPackageV2.find({ status: { $ne: MEMBERSHIP_STATUS.CANCELLED } });
    let updated = 0;
    for (const membership of memberships) {
        const nextStatus = computeStatus(membership);
        if (membership.status !== nextStatus) {
            membership.status = nextStatus;
            await membership.save();
            updated += 1;
        }
    }
    return { checked: memberships.length, updated };
};

module.exports = {
    MEMBERSHIP_STATUS,
    PAYMENT_STATUS,
    EXPIRING_SOON_DAYS,
    validateVietnamesePhone,
    getRemainingDays,
    computeStatus,
    isActive,
    computeEndDate,
    buildMembershipCode,
    summarizeMemberships,
    filterMembership,
    refreshStatuses
};
