import cron from 'node-cron';
import nodemailer from 'nodemailer';
import db from '../config/db.js';

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
  cron.schedule('0 0 * * *', () => {
    console.log('[Cron Job] Đang thực hiện kiểm tra thời hạn toàn bộ gói tập hội viên...');

    // --- NHÓM 1: QUÉT CÁC GÓI CÒN CHÍNH XÁC 10 NGÀY ---
    // Sử dụng DATEDIFF() để tính số ngày chênh lệch giữa ngày kết thúc và ngày hôm nay
    const sqlTenDaysLeft = `
      SELECT up.id, u.email, u.first_name, u.last_name, p.name AS package_name, DATE_FORMAT(up.end_date, '%d/%m/%Y') AS end_date_formated
      FROM user_package up
      JOIN users u ON up.user_id = u.id
      JOIN packages p ON up.package_id = p.id
      WHERE up.status = 'đang hoạt động' AND DATEDIFF(up.end_date, CURDATE()) = 10
    `;

    db.query(sqlTenDaysLeft, (err, rows) => {
      if (err) return console.error('Lỗi truy vấn nhóm sắp hết hạn:', err);

      rows.forEach(row => {
        // Cập nhật trạng thái chuỗi string sang dạng 'còn 10 ngày'
        db.query("UPDATE user_package SET status = 'còn 10 ngày' WHERE id = ?", [row.id], (upErr) => {
          if (upErr) return console.error(upErr);

          // Gửi mail nhắc nhở
          const emailBody = `
            <h3>Xin chào ${row.last_name} ${row.first_name},</h3>
            <p>Gói tập <b>${row.package_name}</b> của bạn tại hệ thống phòng gym chỉ còn lại <b>10 ngày</b> sử dụng (Hết hiệu lực ngày ${row.end_date_formated}).</p>
            <p>Vui lòng đăng ký gia hạn sớm để giữ các ưu đãi và không bị gián đoạn quá trình luyện tập bạn nhé!</p>
          `;
          sendMailHelper(row.email, '[Gym Manager] Thông báo: Gói tập của bạn sắp hết hạn (Còn 10 ngày)', emailBody);
        });
      });
    });

    // --- NHÓM 2: QUÉT CÁC GÓI ĐÃ QUÁ HẠN MÀ CHƯA ĐỔI TRẠNG THÁI ---
    const sqlExpired = `
      SELECT up.id, u.email, u.first_name, u.last_name, p.name AS package_name
      FROM user_package up
      JOIN users u ON up.user_id = u.id
      JOIN packages p ON up.package_id = p.id
      WHERE up.status != 'hết hạn' AND up.end_date < CURDATE()
    `;

    db.query(sqlExpired, (err, rows) => {
      if (err) return console.error('Lỗi truy vấn nhóm đã hết hạn:', err);

      rows.forEach(row => {
        // Cập nhật trạng thái chuỗi string sang dạng 'hết hạn'
        db.query("UPDATE user_package SET status = 'hết hạn' WHERE id = ?", [row.id], (upErr) => {
          if (upErr) return console.error(upErr);

          // Gửi mail thông báo hết hạn
          const emailBody = `
            <h3>Xin chào ${row.last_name} ${row.first_name},</h3>
            <p>Gói tập <b>${row.package_name}</b> của bạn đã chính thức <b>HẾT HẠN</b>.</p>
            <p>Hệ thống tạm thời ngưng quyền check-in của thẻ hội viên này. Bạn có thể mở ứng dụng hoặc liên hệ quầy lễ tân để lựa chọn gói tập mới.</p>
          `;
          sendMailHelper(row.email, '[Gym Manager] Cảnh báo: Gói tập của bạn đã hết hạn', emailBody);
        });
      });
    });

  });
};