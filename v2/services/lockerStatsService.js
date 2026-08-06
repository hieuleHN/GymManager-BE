const getMonthlyLockerStats = async (month, year) => {
    try {
        // Giả lập dữ liệu thống kê tủ đồ theo tháng
        return {
            success: true,
            period: `${month}/${year}`,
            data: {
                totalPeakHoursUsage: 85, // % công suất giờ cao điểm
                mostUsedZone: 'NAM',
                maintenanceCount: 4,
                averageRentalDays: 18
            }
        };
    } catch (error) {
        return {
            success: false,
            message: "Lỗi khi lấy dữ liệu thống kê tủ đồ",
            error: error.message
        };
    }
};

module.exports = {
    getMonthlyLockerStats
};