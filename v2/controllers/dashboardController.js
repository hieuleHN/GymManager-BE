exports.getOverviewStats = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "API thống kê V2 ok",
    });
  } catch (error) {
    console.log("Lỗi dashboard v2:", error);
    return res.status(500).json({ success: false, message: "Lỗi server rồi" });
  }
};
