import Recruitment from "../models/schemas/recruitmentSchema.js";
import nodemailer from "nodemailer";

// 1. CẤU HÌNH BỘ GỬI EMAIL (TRANSPORTER)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Hàm hỗ trợ gửi email (Bọc trong try/catch để nếu lỗi mail cũng không làm sập API)
const sendMail = async (to, subject, htmlContent) => {
  try {
    await transporter.sendMail({
      from: `"ZenFitness Recruitment" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent,
    });
  } catch (error) {
    console.error("Lỗi khi gửi email:", error);
  }
};

// 2. API: ỨNG VIÊN NỘP HỒ SƠ
export const applyJob = async (req, res) => {
  try {
    const { fullName, email, phone, position, description } = req.body;
    if (!req.file)
      return res.status(400).json({ error: "Vui lòng tải lên CV!" });

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

    // --- GỬI MAIL THÔNG BÁO CHO PHÒNG TẬP ---
    const gymEmail = process.env.RECEIVE_EMAIL || "recruitment@zenfitness.com";
    const gymSubject = `[ZenFitness] Có ứng viên mới nộp CV - ${fullName}`;
    const gymHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h3 style="color: #4f46e5;">Có một ứng viên mới vừa nộp hồ sơ!</h3>
        <p><strong>Họ tên:</strong> ${fullName}</p>
        <p><strong>Vị trí ứng tuyển:</strong> ${position}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>SĐT:</strong> ${phone}</p>
        <p>Vui lòng đăng nhập vào trang quản trị Admin để xem chi tiết và duyệt CV.</p>
      </div>
    `;
    // Gọi hàm gửi mail (không dùng await để phản hồi API nhanh chóng cho Client)
    sendMail(gymEmail, gymSubject, gymHtml);

    res
      .status(201)
      .json({ message: "Nộp hồ sơ thành công!", data: newRecruitment });
  } catch (error) {
    res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
  }
};

// 3. API: ADMIN LẤY DANH SÁCH
export const getAllRecruitments = async (req, res) => {
  try {
    const recruitments = await Recruitment.find().sort({ createdAt: -1 });
    res.status(200).json(recruitments);
  } catch (error) {
    res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
  }
};

// 4. API: ADMIN CẬP NHẬT TRẠNG THÁI (KÈM GỬI MAIL CHO ỨNG VIÊN)
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
      { new: true },
    );
    if (!updatedRecruitment)
      return res.status(404).json({ error: "Không tìm thấy hồ sơ" });

    // --- PHÂN LOẠI EMAIL GỬI CHO ỨNG VIÊN THEO TRẠNG THÁI ---
    let subject = "";
    let html = "";

    if (status === "Hẹn phỏng vấn") {
      subject = `[ZenFitness] Thư mời phỏng vấn - Vị trí ${updatedRecruitment.position}`;
      html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h3>Chào ${updatedRecruitment.fullName},</h3>
          <p>Chúng tôi rất ấn tượng với hồ sơ của bạn cho vị trí <strong>${updatedRecruitment.position}</strong>.</p>
          <p>Phòng nhân sự sẽ sớm gọi điện thoại qua số <strong>${updatedRecruitment.phone}</strong> để chốt lịch phỏng vấn cụ thể với bạn.</p>
          <p>Trân trọng,<br>Đội ngũ ZenFitness</p>
        </div>
      `;
      sendMail(updatedRecruitment.email, subject, html);
    } else if (status === "Từ chối") {
      subject = `[ZenFitness] Kết quả ứng tuyển - Vị trí ${updatedRecruitment.position}`;
      html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h3>Chào ${updatedRecruitment.fullName},</h3>
          <p>Cảm ơn bạn đã quan tâm và gửi hồ sơ ứng tuyển vào vị trí <strong>${updatedRecruitment.position}</strong>.</p>
          <p>Sau khi xem xét kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng hồ sơ của bạn hiện tại chưa phù hợp với định hướng của câu lạc bộ.</p>
          <p>Chúc bạn nhiều sức khỏe và thành công trên con đường sự nghiệp.</p>
          <p>Trân trọng,<br>Đội ngũ ZenFitness</p>
        </div>
      `;
      sendMail(updatedRecruitment.email, subject, html);
    } else if (status === "Đã duyệt") {
      subject = `[ZenFitness] Chúc mừng bạn đã trúng tuyển - Vị trí ${updatedRecruitment.position}`;
      html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h3>Chào ${updatedRecruitment.fullName},</h3>
          <p>Chúc mừng bạn đã chính thức trở thành một phần của gia đình ZenFitness ở vị trí <strong>${updatedRecruitment.position}</strong>!</p>
          <p>Phòng nhân sự sẽ gửi email hướng dẫn thủ tục nhận việc trong thời gian sớm nhất.</p>
          <p>Trân trọng,<br>Đội ngũ ZenFitness</p>
        </div>
      `;
      sendMail(updatedRecruitment.email, subject, html);
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
