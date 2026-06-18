import { Notification } from '../models/index.js';
import {
  EmailDeliveryStatus,
  NotificationChannel,
  NotificationStatus
} from '../enums/notificationEnums.js';

export const createNotification = async ({
  receiverUserId,
  typeCode,
  title,
  content,
  channels = [NotificationChannel.IN_APP],
  metadata = {},
  emailStatus = EmailDeliveryStatus.NOT_REQUIRED
}) => {
  if (!receiverUserId || !typeCode || !title || !content) {
    throw new Error('Thiếu dữ liệu bắt buộc để tạo thông báo');
  }

  return Notification.create({
    receiverUserId,
    typeCode,
    title,
    content,
    channels,
    status: NotificationStatus.UNREAD,
    emailStatus: {
      status: channels.includes(NotificationChannel.EMAIL) ? emailStatus : EmailDeliveryStatus.NOT_REQUIRED,
      sentAt: null,
      failedReason: null
    },
    metadata
  });
};

const NotificationService = {
  create: createNotification
};

export default NotificationService;
