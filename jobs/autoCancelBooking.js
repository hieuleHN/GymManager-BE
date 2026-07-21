import Booking from '../models/schemas/bookingSchema.js';
import Customer from '../models/schemas/customerSchema.js';
import { createWalletTransaction } from '../models/walletTransactionModel.js';
import { createNotification } from '../models/notificationModel.js';

const CANCEL_AFTER_HOURS = 20;
const CANCEL_PAYMENT_HOURS = 24;

async function cancelBooking(booking, reason) {
  const customerId = booking.customerId?._id || booking.customerId;
  const refundAmount = booking.price || 0;
  const wasPaid = booking.paymentStatus === 'paid' || booking.paymentStatus === 'confirmed';

  await Booking.findByIdAndUpdate(booking._id, {
    status: 'cancelled',
    paymentStatus: 'cancelled',
    rejectionReason: reason,
    updatedAt: new Date()
  });

  if (wasPaid && refundAmount > 0) {
    try {
      const customer = await Customer.findById(customerId);
      if (customer) {
        const beforeBalance = customer.balance || 0;
        await Customer.findByIdAndUpdate(customerId, {
          $inc: { balance: refundAmount },
          updatedAt: new Date()
        });

        createWalletTransaction({
          customerId,
          type: 'refund',
          amount: refundAmount,
          balanceBefore: beforeBalance,
          balanceAfter: beforeBalance + refundAmount,
          status: 'completed',
          description: `Hoàn tiền tự động - ${reason} - ${refundAmount.toLocaleString('vi-VN')}₫`
        }, () => {});
      }
    } catch {}
  }

  createNotification({
    recipientId: customerId,
    recipientRole: 'member',
    title: 'Lịch tập đã bị hủy',
    message: `Lịch tập lúc ${booking.time || booking.startTime} - ${booking.date ? new Date(booking.date).toLocaleDateString('vi-VN') : ''} đã bị hủy (${reason}).${wasPaid ? ` Đã hoàn ${refundAmount.toLocaleString('vi-VN')}₫ vào Ví.` : ''}`,
    type: 'booking_cancelled',
    relatedBookingId: booking._id
  }, () => {});
}

export async function autoCancelPendingBookings() {
  try {
    const now = new Date();

    // 1. Hủy lịch tập chưa thanh toán quá 24 giờ (dựa vào thời gian tạo)
    const cutoff24h = new Date(now - CANCEL_PAYMENT_HOURS * 60 * 60 * 1000);

    const unpaidExpired = await Booking.find({
      paymentStatus: 'pending',
      createdAt: { $lt: cutoff24h }
    }).populate('customerId', 'balance');

    for (const booking of unpaidExpired) {
      await cancelBooking(booking, 'Quá 24 giờ chưa thanh toán');
    }

    if (unpaidExpired.length > 0) {
      console.log(`[AutoCancel] Đã hủy ${unpaidExpired.length} lịch tập quá hạn thanh toán (24h)`);
    }

    // 2. Hủy lịch tập chưa thanh toán có khung giờ đã qua
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const currentTimeStr = now.toTimeString().slice(0, 5);

    const expiredTimeBookings = await Booking.find({
      paymentStatus: 'pending',
      $or: [
        { date: { $lt: startOfToday } },
        {
          date: { $gte: startOfToday, $lt: endOfToday },
          $or: [
            { time: { $lte: currentTimeStr } },
            { startTime: { $lte: currentTimeStr } }
          ]
        }
      ]
    }).populate('customerId', 'balance');

    for (const booking of expiredTimeBookings) {
      await cancelBooking(booking, 'Quá khung giờ đặt');
    }

    if (expiredTimeBookings.length > 0) {
      console.log(`[AutoCancel] Đã hủy ${expiredTimeBookings.length} lịch tập quá khung giờ đặt`);
    }

    // 3. Hủy lịch tập chờ xác nhận của HLV quá 1 giờ
    const cutoff1h = new Date(now - CANCEL_AFTER_HOURS * 60 * 60 * 1000);
    const pendingBookings = await Booking.find({
      status: 'pending',
      createdAt: { $lt: cutoff1h }
    }).populate('customerId', 'balance');

    for (const booking of pendingBookings) {
      await cancelBooking(booking, 'Huấn luyện viên không xác nhận');
    }

    if (pendingBookings.length > 0) {
      console.log(`[AutoCancel] Đã hủy ${pendingBookings.length} lịch tập quá hạn xác nhận`);
    }
  } catch (err) {
    console.error('[AutoCancel] Lỗi:', err.message);
  }
}
