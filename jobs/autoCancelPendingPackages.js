import UserPackage from '../models/schemas/userPackageSchema.js';
import Notification from '../models/schemas/notificationSchema.js';
import { logAudit } from '../services/auditService.js';

// QUY ĐỊNH MỚI: đơn chờ thanh toán quá 3 ngày (72 giờ) không đóng -> tự hủy
const CANCEL_AFTER_HOURS = 72;
// Trước khi hủy: gửi nhắc thanh toán cho đơn đã treo quá 48h,
// mỗi đơn chỉ nhận nhắc tự động cách nhau tối thiểu 24h.
const REMIND_AFTER_HOURS = 48;
const REMIND_EVERY_HOURS = 24;

const createMemberNotification = async ({ customerId, title, message, type, userPackageId }) => {
  try {
    await Notification.create({
      recipientId: customerId,
      recipientRole: 'member',
      title,
      message,
      type,
      relatedUserPackageId: userPackageId || undefined
    });
  } catch (err) {
    console.error('[AutoCancelPackages] Lỗi tạo thông báo:', err.message);
  }
};

export async function autoCancelPendingPackages() {
  try {
    const now = Date.now();
    const cancelCutoff = new Date(now - CANCEL_AFTER_HOURS * 60 * 60 * 1000);
    const remindCutoff = new Date(now - REMIND_AFTER_HOURS * 60 * 60 * 1000);

    // 1) TỰ HỦY: đơn chờ quá 72h không thanh toán
    const pendingPackages = await UserPackage.find({
      payment_status: 'chờ thanh toán',
      createdAt: { $lt: cancelCutoff }
    });

    for (const pkg of pendingPackages) {
      await UserPackage.findByIdAndUpdate(pkg._id, {
        payment_status: 'đã hủy',
        status: 'đã hủy',
        updatedAt: new Date()
      });

      const pkgInfo = pkg.package_id?.name ? pkg.package_id.name : '';
      await createMemberNotification({
        customerId: pkg.customer_id,
        title: 'Đơn đăng ký gói tập đã bị hủy',
        message: `Đơn đăng ký gói tập ${pkgInfo} đã bị hủy do quá 3 ngày chưa thanh toán.`,
        type: 'package_cancelled',
        userPackageId: pkg._id
      });
    }

    if (pendingPackages.length > 0) {
      console.log(`[AutoCancelPackages] Đã hủy ${pendingPackages.length} đơn chờ thanh toán quá 3 ngày`);
    }

    // 2) NHẮC THANH TOÁN TỰ ĐỘNG: đơn chờ > 48h, lần nhắc cuối cách đây >= 24h
    const remindCandidates = await UserPackage.find({
      payment_status: 'chờ thanh toán',
      createdAt: { $lt: remindCutoff },
      $or: [
        { payment_reminder_sent_at: null },
        { payment_reminder_sent_at: { $lte: new Date(now - REMIND_EVERY_HOURS * 60 * 60 * 1000) } }
      ]
    }).populate('package_id', 'name');

    for (const reg of remindCandidates) {
      const hoursLeft = Math.max(0, Math.ceil(CANCEL_AFTER_HOURS - (now - new Date(reg.createdAt).getTime()) / 3600000));
      await createMemberNotification({
        customerId: reg.customer_id,
        title: 'Nhắc thanh toán gói tập',
        message: `Đơn gói "${reg.package_id?.name || ''}" (${Number(reg.total_price).toLocaleString('vi-VN')} đ) đang chờ thanh toán. Vui lòng thanh toán trong vòng ${hoursLeft} giờ để tránh bị hủy.`,
        type: 'payment_reminder',
        userPackageId: reg._id
      });

      reg.payment_reminder_sent_at = new Date();
      await reg.save();
    }

    if (remindCandidates.length > 0) {
      console.log(`[AutoCancelPackages] Đã gửi ${remindCandidates.length} nhắc thanh toán tự động`);
    }
  } catch (err) {
    console.error('[AutoCancelPackages] Lỗi:', err.message);
  }
}
