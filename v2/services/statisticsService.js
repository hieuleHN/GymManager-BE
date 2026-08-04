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
