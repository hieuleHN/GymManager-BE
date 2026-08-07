const { BookingV2 } = require("../models/bookingModel");

exports.calculateOverview = async () => {
  try {
    return {
      totalRevenue: 250000000,
      totalCustomers: 850,
      activeBookings: 124,
      revenueGrowth: 12.5,
    };
  } catch (error) {
    console.log("Lỗi tính toán overview:", error);
    throw error;
  }
};
exports.getGrowthData = async () => {
  try {
    return {
      labels: ["Tuần 1", "Tuần 2", "Tuần 3", "Tuần 4"],
      datasets: [
        { label: "Khách hàng mới", data: [15, 22, 18, 30] },
        { label: "Booking thành công", data: [120, 150, 145, 180] },
      ],
    };
  } catch (error) {
    console.log("Lỗi gen data chart:", error);
    throw error;
  }
};
