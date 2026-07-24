import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  recipientRole: {
    type: String,
    enum: ['member', 'staff', 'admin'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['booking_request', 'booking_confirmed', 'booking_rejected', 'booking_cancelled', 'locker_resolved', 'locker_rejected', 'transfer_requested', 'transfer_approved', 'transfer_rejected', 'booking_transferred', 'wallet_topup', 'wallet_payment', 'new_article', 'new_community_post', 'like', 'comment', 'report'],
    required: true
  },
  relatedBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  relatedLockerIssueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LockerIssue'
  },
  relatedArticleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article'
  },
  relatedPostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommunityPost'
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Notification', notificationSchema);