import cron from "node-cron";
import nodemailer from "nodemailer";
import UserPackage from "../models/schemas/userPackageSchema.js";
import Customer from "../models/schemas/customerSchema.js";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendMail = async (to, subject, html) => {
  try {
    if (!to || !to.includes("@")) return;
    await transporter.sendMail({
      from: `"ZenFitness" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`[ExpiryCron] Đã gửi mail tới ${to} - ${subject}`);
  } catch (err) {
    console.error(`[ExpiryCron] Lỗi gửi mail tới ${to}:`, err.message);
  }
};

export const startCustomerExpiryCron = () => {
  // Chạy mỗi ngày lúc 08:00 sáng
  cron.schedule("0 8 * * *", async () => {
    try {
      console.log("[ExpiryCron] Kiểm tra gói sắp hết hạn...");
      const now = new Date();
      const thresholds = [7, 3, 1]; // gửi trước 7/3/1 ngày

      for (const days of thresholds) {
        const targetDate = new Date(now);
        targetDate.setHours(0, 0, 0, 0);
        const windowStart = new Date(targetDate);
        windowStart.setDate(windowStart.getDate() + days);
        const windowEnd = new Date(windowStart);
        windowEnd.setHours(23, 59, 59, 999);

        const packages = await UserPackage.find({
          payment_status: "đã thanh toán",
          status: { $in: ["đang hoạt động", "còn 10 ngày"] },
          end_date: { $gte: windowStart, $lte: windowEnd },
        })
          .populate("customer_id", "fullName email phone")
          .populate("package_id", "name");

        for (const pkg of packages) {
          const customer = pkg.customer_id;
          if (!customer?.email) continue;

          // Chống spam: nếu đã gửi trong 20h qua thì bỏ qua
          if (pkg.last_renewal_reminder_at) {
            const diffHours = (now - new Date(pkg.last_renewal_reminder_at)) / (1000 * 60 * 60);
            if (diffHours < 20) continue;
          }

          const pkgName = pkg.package_id?.name || "Gói tập";
          const endStr = new Date(pkg.end_date).toLocaleDateString("vi-VN");
          const subject = `[ZenFitness] Gói tập sắp hết hạn trong ${days} ngày - ${pkgName}`;
          const html = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;">
              <h3 style="color: #4f46e5;">Chào ${customer.fullName || customer.account || "hội viên"},</h3>
              <p>Gói tập <strong>${pkgName}</strong> của bạn sẽ hết hạn vào ngày <strong>${endStr}</strong> (còn <strong>${days} ngày</strong>).</p>
              <p>Vui lòng gia hạn sớm để không gián đoạn tập luyện. Bạn có thể gia hạn tại quầy lễ tân hoặc liên hệ: <strong>${customer.phone || ""}</strong>.</p>
              <p>Chi tiết gói: ${pkg.total_price?.toLocaleString("vi-VN")}đ - ${pkg.duration_months} tháng</p>
              <p>Trân trọng,<br/>Đội ngũ ZenFitness</p>
            </div>
          `;
          await sendMail(customer.email, subject, html);

          // Đánh dấu đã gửi để tránh spam
          pkg.last_renewal_reminder_at = new Date();
          await pkg.save();
        }
      }
      console.log("[ExpiryCron] Hoàn tất kiểm tra.");
    } catch (err) {
      console.error("[ExpiryCron] Lỗi:", err.message);
    }
  });
  console.log("✅ CustomerExpiryCron đã lên lịch 08:00 hàng ngày (7/3/1 ngày)");
};
