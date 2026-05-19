import mongoose from 'mongoose';
import {
  EmailDeliveryStatus,
  NotificationChannel,
  NotificationStatus
} from '../enums/notificationEnums.js';
import { objectId } from './sharedModels.js';

const notificationsSchema = new mongoose.Schema({
  receiverUserId: { type: objectId, ref: 'User', required: true },
  typeCode: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  channels: { type: [String], enum: Object.values(NotificationChannel), default: [NotificationChannel.IN_APP] },
  status: { type: String, enum: Object.values(NotificationStatus), default: NotificationStatus.UNREAD },
  emailStatus: {
    status: { type: String, enum: Object.values(EmailDeliveryStatus), default: EmailDeliveryStatus.NOT_REQUIRED },
    sentAt: { type: Date, default: null },
    failedReason: { type: String, default: null }
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationsSchema, 'notifications');
export default Notification;
