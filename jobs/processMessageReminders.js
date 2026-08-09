import { getDueReminders, markReminderFired } from '../models/messageModel.js';
import { createNotification } from '../models/notificationModel.js';
import { emitToUser } from '../config/socket.js';

export const processDueMessageReminders = async () => {
  try {
    const reminders = await getDueReminders();
    for (const reminder of reminders) {
      const title = reminder.loai === 'ho_tro'
        ? 'Nhắc hẹn tin nhắn hỗ trợ'
        : 'Nhắc hẹn tin nhắn';
      const message = `"${reminder.noi_dung}"`;

      await new Promise((resolve, reject) => {
        createNotification({
          recipientId: reminder.recipientId,
          recipientRole: reminder.recipientRole,
          title,
          message,
          type: 'message_reminder'
        }, (err, notif) => (err ? reject(err) : resolve(notif)));
      });

      emitToUser(reminder.recipientId.toString(), 'receiveNotification', {
        title,
        message,
        type: 'message_reminder'
      });

      await markReminderFired(reminder._id);
      console.log(`[Cron] Đã gửi nhắc hẹn tin nhắn ${reminder.messageId} tới user ${reminder.recipientId}`);
    }
  } catch (err) {
    console.error('[Cron] Lỗi xử lý nhắc hẹn tin nhắn:', err.message);
  }
};
