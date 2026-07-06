import Recruitment from "../models/schemas/recruitmentSchema.js";

// 1. API: Người dùng nộp hồ sơ (Sẽ có đính kèm file)
export const applyJob = async (req, res) => {
  try {
    const { fullName, email, phone, position, description } = req.body;

    // Kiểm tra xem multer đã bắt được file chưa
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Vui lòng tải lên file CV đính kèm!" });
    }

    // Tạo đường dẫn file để lưu vào Database
    const cvUrl = `/uploads/cvs/${req.file.filename}`;

    const newRecruitment = new Recruitment({
      fullName,
      email,
      phone,
      position,
      description,
      cvUrl,
    });

    await newRecruitment.save();
    res
      .status(201)
      .json({ message: "Nộp hồ sơ thành công!", data: newRecruitment });
  } catch (error) {
    res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
  }
};

// 2. API: Admin lấy danh sách hồ sơ
export const getAllRecruitments = async (req, res) => {
  try {
    // Sắp xếp hồ sơ mới nhất lên đầu
    const recruitments = await Recruitment.find().sort({ createdAt: -1 });
    res.status(200).json(recruitments);
  } catch (error) {
    res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
  }
};

// 3. API: Admin cập nhật trạng thái hồ sơ
export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["Chờ xử lý", "Hẹn phỏng vấn", "Đã duyệt", "Từ chối"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ" });
    }

    const updatedRecruitment = await Recruitment.findByIdAndUpdate(
      id,
      { status },
      { new: true }, // Trả về bản ghi mới sau khi cập nhật
    );

    if (!updatedRecruitment) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ" });
    }

    res
      .status(200)
      .json({
        message: "Cập nhật trạng thái thành công",
        data: updatedRecruitment,
      });
  } catch (error) {
    res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
  }
};
