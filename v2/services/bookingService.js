const { BookingV2, BOOKING_STATUS } = require('../models/bookingModel');

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

const parseLocalDate = (dateStr) => {
    if (dateStr instanceof Date) {
        return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
    }
    const str = String(dateStr).trim();
    if (!str) return null;
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const y = parseInt(match[1], 10);
        const mo = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        return new Date(y, mo - 1, day);
    }
    return new Date(str);
};

const toMinutes = (timeStr) => {
    const str = String(timeStr || '').trim();
    const match = str.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
};

const minutesToLabel = (minutes) => {
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const isTimeOverlap = (aStart, aEnd, bStart, bEnd) => {
    return aStart < bEnd && bStart < aEnd;
};

const formatTimeLabel = (dateInput) => {
    const d = new Date(dateInput);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
};

const generateBookingCode = async () => {
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    let code = '';
    let exists = true;
    while (exists) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        code = `BK-${ymd}-${rand}`;
        exists = await BookingV2.exists({ bookingCode: code });
    }
    return code;
};

const computeDuration = (startTime, endTime) => {
    const start = toMinutes(startTime);
    const end = toMinutes(endTime);
    if (start === null || end === null || end <= start) return 60;
    return end - start;
};

const findConflictingBookings = async ({ trainerId, date, startTime, endTime, excludeId } = {}) => {
    if (!trainerId || !date || !startTime || !endTime) return [];
    const { start, end } = getDayRange(date);
    const startMin = toMinutes(startTime);
    const endMin = toMinutes(endTime);
    if (startMin === null || endMin === null) return [];

    const filter = {
        trainerId,
        date: { $gte: start, $lte: end },
        status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED] }
    };
    if (excludeId) filter._id = { $ne: excludeId };

    const candidates = await BookingV2.find(filter).select('bookingCode trainerId date startTime endTime status');
    return candidates.filter(record => isTimeOverlap(startMin, endMin, toMinutes(record.startTime), toMinutes(record.endTime)));
};

const filterBooking = (record, { status, sessionType, search } = {}) => {
    if (status && status !== 'ALL' && record.status !== status) return false;
    if (sessionType && sessionType !== 'ALL' && record.sessionType !== sessionType) return false;
    if (search) {
        const keyword = String(search).trim().toLowerCase();
        if (!keyword) return true;
        const matchCode = (record.bookingCode || '').toLowerCase().includes(keyword);
        const matchName = (record.customerName || '').toLowerCase().includes(keyword);
        const matchPhone = (record.customerPhone || '').toLowerCase().includes(keyword);
        const matchTrainer = (record.trainerName || '').toLowerCase().includes(keyword);
        const matchPackage = (record.packageName || '').toLowerCase().includes(keyword);
        if (!matchCode && !matchName && !matchPhone && !matchTrainer && !matchPackage) return false;
    }
    return true;
};

const summarizeBookings = (records) => {
    const counts = {};
    Object.values(BOOKING_STATUS).forEach(status => {
        counts[status] = 0;
    });
    let totalPrice = 0;
    let paidCount = 0;
    records.forEach(record => {
        counts[record.status] = (counts[record.status] || 0) + 1;
        totalPrice += Number(record.price) || 0;
        if (record.paymentStatus === 'PAID') paidCount += 1;
    });
    return {
        total: records.length,
        counts,
        pendingCount: counts[BOOKING_STATUS.PENDING] || 0,
        confirmedCount: counts[BOOKING_STATUS.CONFIRMED] || 0,
        completedCount: counts[BOOKING_STATUS.COMPLETED] || 0,
        cancelledCount: counts[BOOKING_STATUS.CANCELLED] || 0,
        rejectedCount: counts[BOOKING_STATUS.REJECTED] || 0,
        totalPrice,
        paidCount
    };
};

const buildTrend = (records, days) => {
    const dayMap = {};
    records.forEach(record => {
        const key = toDateKey(record.date);
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

const buildTrainerWorkSlots = (workSchedule) => {
    const slots = [];
    (workSchedule || []).forEach(item => {
        const dayOfWeek = Number(item.dayOfWeek);
        const start = toMinutes(item.startTime || '08:00');
        const end = toMinutes(item.endTime || '17:00');
        if (start === null || end === null) return;
        for (let t = start; t + 60 <= end; t += 60) {
            slots.push({
                dayOfWeek,
                startTime: minutesToLabel(t),
                endTime: minutesToLabel(t + 60)
            });
        }
    });
    return slots;
};

module.exports = {
    BOOKING_STATUS,
    validateVietnamesePhone,
    getDayRange,
    toDateKey,
    parseLocalDate,
    toMinutes,
    minutesToLabel,
    formatTimeLabel,
    isTimeOverlap,
    generateBookingCode,
    computeDuration,
    findConflictingBookings,
    filterBooking,
    summarizeBookings,
    buildTrend,
    buildTrainerWorkSlots
};
