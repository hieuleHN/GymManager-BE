import mongoose from "mongoose";

const recruitmentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Vui lòng nhập họ và tên"],
    },
    email: {
      type: String,
      required: [true, "Vui lòng nhập email"],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Email không hợp lệ",
      ],
    },
    phone: {
      type: String,
      required: [true, "Vui lòng nhập số điện thoại"],
    },
    position: {
      type: String,
      required: [true, "Vui lòng chọn vị trí ứng tuyển"],
    },
    description: {
      type: String,
      default: "",
    },
    cvUrl: {
      type: String,
      required: [true, "Vui lòng tải lên CV (PDF hoặc Word)"],
    },
    status: {
      type: String,
      enum: ["Chờ xử lý", "Hẹn phỏng vấn", "Đã duyệt", "Từ chối"],
      default: "Chờ xử lý",
    },
  },
  {
    timestamps: true, // Tự động tạo trường createdAt và updatedAt
  },
);

const Recruitment = mongoose.model("Recruitment", recruitmentSchema);
export default Recruitment;
