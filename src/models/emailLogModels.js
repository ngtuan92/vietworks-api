import mongoose from 'mongoose';
import { EmailDeliveryStatus, EmailProvider } from '../enums/notificationEnums.js';
import { objectId } from './sharedModels.js';

const emailLogSchema = new mongoose.Schema({
  receiverUserId: { type: objectId, ref: 'User', required: true },
  notificationId: { type: objectId, ref: 'Notification', default: null },
  toEmail: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  provider: { type: String, enum: Object.values(EmailProvider), required: true },
  status: { type: String, enum: [EmailDeliveryStatus.PENDING, EmailDeliveryStatus.SENT, EmailDeliveryStatus.FAILED], default: EmailDeliveryStatus.PENDING },
  sentAt: { type: Date, default: null },
  failedReason: { type: String, default: null }
}, { timestamps: { createdAt: true, updatedAt: false } });

const EmailLog = mongoose.model('EmailLog', emailLogSchema, 'email_logs');
export default EmailLog;
