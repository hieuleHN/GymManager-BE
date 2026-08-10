import ServiceRequest from '../models/schemas/serviceRequestSchema.js';
import Customer from '../models/schemas/customerSchema.js';
import { LockerV2, LOCKER_STATUS } from '../models/lockerManagementModel.js';
import { createWalletTransaction } from '../models/walletTransactionModel.js';
import { createNotification } from '../models/notificationModel.js';
import { updateRequestStatus } from '../models/serviceRequestModel.js';

// Tủ đã hết hạn thuê -> chuyển trạng thái "chờ trả chìa khoá" (AWAIT_KEY_RETURN)
export const expireLockerRentals = async () => {
  try {
    const now = new Date();
    const lockers = await LockerV2.find({
      status: LOCKER_STATUS.OCCUPIED,
      rentalDays: { $gt: 0 },
      rentedAt: { $ne: null }
    });
    for (const locker of lockers) {
      const end = new Date(locker.rentedAt);
      end.setDate(end.getDate() + (locker.rentalDays || 1));
      if (now >= end) {
        locker.status = LOCKER_STATUS.AWAIT_KEY_RETURN;
        await locker.save();
      }
    }
  } catch (err) {
    console.error('[Cron] Lỗi hết hạn thuê tủ:', err.message);
  }
};

export const autoExpireServiceRequests = async () => {
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const expired = await ServiceRequest.find({
      status: 'pending',
      createdAt: { $lte: cutoff }
    });

    for (const request of expired) {
      const amount = Math.floor(Number(request.amount) || 0);
      const hasPaid = request.payment_status === 'paid' && amount > 0;

      if (hasPaid) {
        const customer = await Customer.findByIdAndUpdate(
          request.customer_id,
          { $inc: { balance: amount }, updatedAt: new Date() },
          { new: true }
        );
        await new Promise((resolve) => {
          createWalletTransaction({
            customerId: request.customer_id,
            type: 'refund',
            amount,
            balanceBefore: (customer?.balance || 0) - amount,
            balanceAfter: customer?.balance || 0,
            status: 'completed',
            description: `Hoàn tiền yêu cầu "${request.service_type}" quá 24 giờ chưa được xử lý - ${amount.toLocaleString('vi-VN')}₫`
          }, () => resolve(null));
        });
        await new Promise((resolve) => {
          createNotification({
            recipientId: request.customer_id,
            recipientRole: 'member',
            title: 'Yêu cầu đã hết hạn',
            message: `Yêu cầu "${request.service_type}" của bạn quá 24 giờ chưa được xử lý. ${amount.toLocaleString('vi-VN')}₫ đã được hoàn vào ví điện tử.`,
            type: 'wallet_topup'
          }, () => resolve(null));
        });
        await updateRequestStatus(
          request._id,
          {
            status: 'cancelled',
            payment_status: 'refunded',
            refund_amount: amount,
            refunded_at: new Date(),
            admin_note: 'Tự động hết hạn sau 24 giờ chưa được xử lý. Đã hoàn tiền vào ví hội viên.'
          },
          () => {}
        );
      } else {
        await updateRequestStatus(
          request._id,
          {
            status: 'cancelled',
            admin_note: 'Tự động hết hạn sau 24 giờ chưa được xử lý.'
          },
          () => {}
        );
      }
    }
  } catch (err) {
    console.error('[Cron] Lỗi tự động hết hạn yêu cầu dịch vụ:', err.message);
  }
};

export const processPendingLockerRequests = async () => {
  try {
    // Chỉ xử lý yêu cầu đã được admin chấp thuận nhưng đang chờ tủ trống (data.lockerWaiting === true)
    const pendingLockers = await ServiceRequest.find({
      service_type: 'locker',
      status: 'pending',
      'data.lockerWaiting': true,
      'data.lockerId': { $ne: null, $exists: true }
    }).sort({ createdAt: 1 });

    for (const request of pendingLockers) {
      const lockerId = request.data?.lockerId;
      if (!lockerId) continue;
      const locker = await LockerV2.findById(lockerId);
      if (!locker || locker.status !== LOCKER_STATUS.AVAILABLE) continue;

      locker.status = LOCKER_STATUS.OCCUPIED;
      locker.assignedType = 'MEMBER';
      locker.assignedName = request.customer_name || 'Hội viên';
      locker.assignedPhone = request.customer_phone || '';
      locker.assignedAt = new Date();
      locker.rentalDays = Math.min(20, Math.max(1, parseInt(request.data?.durationDays, 10) || 1));
      locker.rentedAt = locker.assignedAt;
      locker.note = locker.note || locker.lockerNumber;
      await locker.save();

      const cleared = { ...request.data };
      delete cleared.lockerWaiting;
      await updateRequestStatus(
        request._id,
        {
          status: 'accepted',
          processed_at: new Date(),
          admin_note: 'Tự động xử lý khi tủ trống.',
          data: cleared
        },
        () => {}
      );

      await new Promise((resolve) => {
        createNotification({
          recipientId: request.customer_id,
          recipientRole: 'member',
          title: 'Thuê tủ đồ thành công',
          message: `Tủ ${locker.lockerNumber} đã trống và được gán cho bạn. Hạn thuê ${request.data?.durationDays || ''} ngày.`,
          type: 'service'
        }, () => resolve(null));
      });
    }
  } catch (err) {
    console.error('[Cron] Lỗi tự động gán tủ:', err.message);
  }
};