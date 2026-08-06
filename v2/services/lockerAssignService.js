const autoAssignLocker = async (customerId, preferredZone = 'NAM') => {
    try {
        // Giả lập logic tìm tủ đồ còn trống theo khu vực
        const availableLockerCode = `LK-${Math.floor(100 + Math.random() * 900)}`;

        return {
            success: true,
            message: `Đã tự động gán tủ đồ ${availableLockerCode} cho hội viên`,
            data: {
                customerId,
                lockerCode: availableLockerCode,
                zone: preferredZone,
                assignedAt: new Date()
            }
        };
    } catch (error) {
        return {
            success: false,
            message: "Lỗi trong quá trình tự động gán tủ đồ",
            error: error.message
        };
    }
};

module.exports = {
    autoAssignLocker
};