import UserPackage from '../models/schemas/userPackageSchema.js';
import { createNotification } from '../models/notificationModel.js';

const CANCEL_AFTER_HOURS = 24;

export async function autoCancelPendingPackages() {
  try {
    const cutoff = new Date(Date.now() - CANCEL_AFTER_HOURS * 60 * 60 * 1000);

    const pendingPackages = await UserPackage.find({
      payment_status: 'chờ thanh toán',
      createdAt: { $lt: cutoff }
    });

    for (const pkg of pendingPackages) {
      const customerId = pkg.customer_id;

      await UserPackage.findByIdAndUpdate(pkg._id, {
        payment_status: 'đã hủy',
        status: 'đã hủy',
        updatedAt: new Date()
      });

      createNotification({
        recipientId: customerId,
        recipientRole: 'member',
        title: 'Đơn đăng ký gói tập đã bị hủy',
        message: `Đơn đăng ký gói tập ${pkg.package_id?.name || ''} đã bị hủy do quá 24 giờ chưa thanh toán.`,
        type: 'package_cancelled',
        relatedPackageId: pkg._id
      }, () => {});
    }

    if (pendingPackages.length > 0) {
      console.log(`[AutoCancelPackages] Đã hủy ${pendingPackages.length} đơn đăng ký gói tập quá hạn thanh toán`);
    }
  } catch (err) {
    console.error('[AutoCancelPackages] Lỗi:', err.message);
  }
}
