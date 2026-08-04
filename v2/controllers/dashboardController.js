exports.getOverviewStats = async (req, res) => {
  try {
    const mockStats = {
      totalRevenue: 125000000,
      totalCustomers: 1420,
      activeBookings: 320,
    };
    return res.status(200).json({
      success: true,
      message: "API thống kê V2 ok",
    });
  } catch (error) {
    console.log("Lỗi dashboard v2:", error);
    return res.status(500).json({ success: false, message: "Lỗi server rồi" });
  }
};
