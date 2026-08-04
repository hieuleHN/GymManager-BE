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
      data: mockStats,
    });
  } catch (error) {
    console.log("Lỗi dashboard v2:", error);
    return res.status(500).json({ success: false, message: "Lỗi server rồi" });
  }
};

exports.getChartData = async (req, res) => {
  try {
    const chartData = {
      labels: ["Tuần 1", "Tuần 2", "Tuần 3", "Tuần 4"],
      datasets: [{ label: "Khách hàng mới", data: [15, 22, 18, 30] }],
    };

    return res.status(200).json({ success: true, data: chartData });
  } catch (error) {
    console.log("Lỗi chart v2:", error);
    return res.status(500).json({ success: false, message: "Lỗi load chart" });
  }
};
