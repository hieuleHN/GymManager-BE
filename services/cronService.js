import cron from 'node-cron';
import Customer from '../models/schemas/customerSchema.js';
import UserPackage from '../models/schemas/userPackageSchema.js';
import { lockCustomer } from '../models/customerModel.js';
import { autoCancelPendingBookings } from '../jobs/autoCancelBooking.js';
import { autoCancelPendingPackages } from '../jobs/autoCancelPendingPackages.js';
import { processDueMessageReminders } from '../jobs/processMessageReminders.js';
import { autoExpireServiceRequests, processPendingLockerRequests, expireLockerRentals } from '../jobs/serviceRequestAuto.js';

export const initPackageStatusScheduler = () => {
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

  cron.schedule('* * * * *', async () => {
    console.log('[Cron Job] Kiểm tra lịch tập quá hạn...');
    try {
      await autoCancelPendingBookings();
    } catch (err) {
      console.error('[Cron Job] Lỗi hủy lịch tập:', err);
    }
  });

  cron.schedule('* * * * *', async () => {
    console.log('[Cron Job] Kiểm tra đơn đăng ký gói tập quá hạn thanh toán...');
    try {
      await autoCancelPendingPackages();
    } catch (err) {
      console.error('[Cron Job] Lỗi hủy gói tập:', err);
    }
  });

  cron.schedule('* * * * *', async () => {
    try {
      await processDueMessageReminders();
    } catch (err) {
      console.error('[Cron Job] Lỗi xử lý nhắc hẹn tin nhắn:', err);
    }
  });

  cron.schedule('* * * * *', async () => {
    try {
      await autoExpireServiceRequests();
      await expireLockerRentals();
      await processPendingLockerRequests();
    } catch (err) {
      console.error('[Cron Job] Lỗi xử lý yêu cầu dịch vụ tự động:', err);
    }
  });

  cron.schedule('* * * * *', async () => {
    console.log('[Cron Job] Kiểm tra gói tập tạm ngưng hết hạn để tự động kích hoạt lại...');
    try {
      const now = new Date();
      const frozenRegs = await UserPackage.find({
        status: 'đang tạm ngưng',
        frozenUntil: { $lte: now }
      });
      for (const reg of frozenRegs) {
        if (reg.frozenAt) {
          const frozenMs = now - new Date(reg.frozenAt);
          const frozenDays = Math.max(0, Math.ceil(frozenMs / 86400000));
          if (frozenDays > 0 && reg.end_date) {
            const end = new Date(reg.end_date);
            end.setDate(end.getDate() + frozenDays);
            reg.end_date = end;
          }
        }
        reg.frozenAt = null;
        reg.frozenUntil = null;
        reg.status = 'đang hoạt động';
        await reg.save();
        console.log(`[Cron Job] Đã tự động kích hoạt lại gói ${reg._id} sau thời gian tạm ngưng`);
      }
    } catch (err) {
      console.error('[Cron Job] Lỗi tự động kích hoạt gói tạm ngưng:', err);
    }
  });
};
