import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import UserPackage from '../models/schemas/userPackageSchema.js';
import Customer from '../models/schemas/customerSchema.js';

export const initPackageStatusScheduler = () => {
  // Kiểm tra thời hạn điền thông tin hội viên
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron Job] Đang kiểm tra thời hạn điền thông tin hội viên...');

    try {
      const now = new Date();
      const fiveDaysAgo = new Date(now);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const customers = await Customer.find({
        status: 'pending',
        infoFilledAt: { $exists: false }
      });

      for (const customer of customers) {
        const daysSinceRegister = Math.floor((now - new Date(customer.createdAt)) / (1000 * 60 * 60 * 24));

        if (daysSinceRegister >= 10) {
          await Customer.findByIdAndUpdate(customer._id, {
            status: 'locked',
            updatedAt: new Date()
          });
          console.log(`[Cron Job] Đã khóa tài khoản ${customer.account} do không điền thông tin sau 10 ngày`);
        } else if (daysSinceRegister >= 5) {
          console.log(`[Cron Job] Hội viên ${customer.account} còn ${10 - daysSinceRegister} ngày để điền thông tin`);
        }
      }
    } catch (error) {
      console.error('[Cron Job] Lỗi:', error);
    }
  });

  // Xóa các đăng ký chưa thanh toán quá hạn
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Cron Job] Đang kiểm tra đăng ký chưa thanh toán quá hạn...');

    try {
      const now = new Date();
      const expiredRegistrations = await UserPackage.find({
        payment_status: 'pending',
        payment_expires_at: { $lte: now }
      });

      for (const reg of expiredRegistrations) {
        // Xóa PDF nếu có
        if (reg.contract_pdf) {
          const pdfPath = path.resolve('uploads/contracts', reg.contract_pdf);
          try {
            if (fs.existsSync(pdfPath)) {
              fs.unlinkSync(pdfPath);
              console.log(`[Cron Job] Đã xóa PDF: ${reg.contract_pdf}`);
            }
          } catch (e) {
            console.error(`[Cron Job] Lỗi xóa PDF ${reg.contract_pdf}:`, e);
          }
        }

        // Cập nhật trạng thái
        reg.payment_status = 'cancelled';
        reg.status = 'đã hủy';
        reg.contract_pdf = '';
        await reg.save();
        console.log(`[Cron Job] Đã hủy đăng ký ${reg._id} do quá hạn thanh toán`);
      }
    } catch (error) {
      console.error('[Cron Job] Lỗi:', error);
    }
  });
};
