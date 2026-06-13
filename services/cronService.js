import cron from 'node-cron';
import nodemailer from 'nodemailer';
import UserPackage from '../models/schemas/userPackageSchema.js';

// 1. Thiết lập cấu hình hòm thư gửi Mail tự động (Ví dụ sử dụng Gmail làm SMTP Server)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'phonggymcuaban@gmail.com', // Email của bạn
    pass: process.env.EMAIL_PASS || 'your_app_password_here'   // Mật khẩu ứng dụng của Gmail
  }
});

// Hàm bổ trợ gửi email nhanh
const sendMailHelper = (toEmail, subject, textHtml) => {
  const mailOptions = {
    from: `"Gym Manager System 🏋️" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    html: textHtml
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) console.error('[-] Thất bại khi gửi email thông báo:', error.message);
    else console.log('[+] Đã gửi email thông báo thành công tới:', toEmail);
  });
};

// 2. KHỞI CHẠY TIẾN TRÌNH QUÉT TỰ ĐỘNG (CRON JOB)
export const initPackageStatusScheduler = () => {
  // Tiến trình chạy tự động vào lúc 00:00 (nửa đêm) mỗi ngày
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron Job] Đang thực hiện kiểm tra thời hạn toàn bộ gói tập hội viên...');

    try {
      // --- NHÓM 1: QUÉT CÁC GÓI CÒN CHÍNH XÁC 10 NGÀY ---
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tenDaysFromNow = new Date(today);
      tenDaysFromNow.setDate(today.getDate() + 10);
      tenDaysFromNow.setHours(23, 59, 59, 999);

      const packagesIn10Days = await UserPackage.find({
        status: 'đang hoạt động',
        end_date: { $gte: today, $lte: tenDaysFromNow }
      }).populate({
        path: 'user_id',
        select: 'email first_name last_name'
      }).populate({
        path: 'package_id',
        select: 'name'
      });

      for (const userPackage of packagesIn10Days) {
        // Cập nhật trạng thái
        await UserPackage.findByIdAndUpdate(userPackage._id, { status: 'còn 10 ngày' });

        // Gửi mail nhắc nhở
        const endDate = new Intl.DateTimeFormat('vi-VN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(userPackage.end_date);

        const emailBody = `
          <h3>Xin chào ${userPackage.user_id.last_name} ${userPackage.user_id.first_name},</h3>
          <p>Gói tập <b>${userPackage.package_id.name}</b> của bạn tại hệ thống phòng gym chỉ còn lại <b>10 ngày</b> sử dụng (Hết hiệu lực ngày ${endDate}).</p>
          <p>Vui lòng đăng ký gia hạn sớm để giữ các ưu đãi và không bị gián đoạn quá trình luyện tập bạn nhé!</p>
        `;
        sendMailHelper(userPackage.user_id.email, '[Gym Manager] Thông báo: Gói tập của bạn sắp hết hạn (Còn 10 ngày)', emailBody);
      }

      // --- NHÓM 2: QUÉT CÁC GÓI ĐÃ QUÁ HẠN MÀ CHƯA ĐỔI TRẠNG THÁI ---
      const expiredPackages = await UserPackage.find({
        status: { $ne: 'hết hạn' },
        end_date: { $lt: today }
      }).populate({
        path: 'user_id',
        select: 'email first_name last_name'
      }).populate({
        path: 'package_id',
        select: 'name'
      });

      for (const userPackage of expiredPackages) {
        // Cập nhật trạng thái
        await UserPackage.findByIdAndUpdate(userPackage._id, { status: 'hết hạn' });

        // Gửi mail thông báo hết hạn
        const emailBody = `
          <h3>Xin chào ${userPackage.user_id.last_name} ${userPackage.user_id.first_name},</h3>
          <p>Gói tập <b>${userPackage.package_id.name}</b> của bạn đã chính thức <b>HẾT HẠN</b>.</p>
          <p>Hệ thống tạm thời ngưng quyền check-in của thẻ hội viên này. Bạn có thể mở ứng dụng hoặc liên hệ quầy lễ tân để lựa chọn gói tập mới.</p>
        `;
        sendMailHelper(userPackage.user_id.email, '[Gym Manager] Cảnh báo: Gói tập của bạn đã hết hạn', emailBody);
      }

    } catch (error) {
      console.error('[Cron Job] Lỗi:', error);
    }
  });
};