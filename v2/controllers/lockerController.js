const validateLockerCode = (code) => {
    if (!code || typeof code !== 'string') return false;
    // Mã tủ đồ chuẩn có dạng L-001 hoặc LK001
    return /^LK?-\d{3,4}$/i.test(code.trim());
};

const formatLockerStatus = (status) => {
    const statusMap = {
        AVAILABLE: 'Trống',
        OCCUPIED: 'Đang sử dụng',
        MAINTENANCE: 'Bảo trì / Hỏng',
        RESERVED: 'Đã đặt trước'
    };
    return statusMap[status?.toUpperCase()] || 'Không xác định';
};

const getLockerUsageRate = (totalLockers, occupiedLockers) => {
    if (!totalLockers || totalLockers <= 0) return 0;
    return Math.round((occupiedLockers / totalLockers) * 100);
};

module.exports = {
    validateLockerCode,
    formatLockerStatus,
    getLockerUsageRate
};