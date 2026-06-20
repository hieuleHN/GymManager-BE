import cron from 'node-cron';
import Customer from '../models/schemas/customerSchema.js';
import { lockCustomer } from '../models/customerModel.js';

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
};
