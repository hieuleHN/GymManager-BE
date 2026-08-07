const statisticsService = require("../services/statisticsService");

exports.getOverviewStats = async (req, res) => {
  try {
    const statsData = await statisticsService.calculateOverview();

    return res.status(200).json({
      success: true,
      message: "Lấy dữ liệu thống kê V2 thành công",
      data: statsData,
    });
  } catch (error) {
    console.log("Lỗi dashboard v2:", error);
    return res.status(500).json({ success: false, message: "Lỗi server rồi" });
  }
};

exports.getChartData = async (req, res) => {
  try {
    const chartData = await statisticsService.getGrowthData();

    return res.status(200).json({ success: true, data: chartData });
  } catch (error) {
    console.log("Lỗi chart v2:", error);
    return res.status(500).json({ success: false, message: "Lỗi load chart" });
  }
};
