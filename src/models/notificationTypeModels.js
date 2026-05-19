import mongoose from 'mongoose';
import { UserRole } from '../enums/userEnums.js';
import { CommonStatus } from '../enums/masterDataEnums.js';
import { NotificationChannel, NotificationTypeCode } from '../enums/notificationEnums.js';

const notificationTypeSchema = new mongoose.Schema({
  code: { type: String, enum: Object.values(NotificationTypeCode), required: true, unique: true },
  name: { type: String, required: true },
  targetRole: { type: String, enum: [...Object.values(UserRole), 'ALL'], required: true },
  defaultChannels: { type: [String], enum: Object.values(NotificationChannel), default: [NotificationChannel.IN_APP] },
  status: { type: String, enum: Object.values(CommonStatus), default: CommonStatus.ACTIVE }
}, { timestamps: true });

const NotificationType = mongoose.model('NotificationType', notificationTypeSchema, 'notification_types');
export default NotificationType;
