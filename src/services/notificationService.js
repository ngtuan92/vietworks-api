import { Notification } from '../models/index.js';
import User from '../models/userModels.js';
import JobseekerProfile from '../models/jobseekerProfileModels.js';
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

  const [user, jsProfile] = await Promise.all([
    User.findById(receiverUserId).select('notificationSettings').lean(),
    JobseekerProfile.findOne({ userId: receiverUserId }).select('notificationSettings').lean()
  ]);
  
  const userSettings = user?.notificationSettings || {};

  let finalChannels = [...channels];

  let sysEnabled = userSettings[`${typeCode}_SYSTEM`] !== false;
  let emailEnabled = userSettings[`${typeCode}_EMAIL`] !== false;

  if (jsProfile && jsProfile.notificationSettings) {
    const jsSetting = jsProfile.notificationSettings.find(s => s.typeCode === typeCode);
    if (jsSetting) {
      if (jsSetting.inApp === false) sysEnabled = false;
      if (jsSetting.email === false) emailEnabled = false;
    }
  }

  if (finalChannels.includes(NotificationChannel.IN_APP) && !sysEnabled) {
    finalChannels = finalChannels.filter(c => c !== NotificationChannel.IN_APP);
  }

  if (finalChannels.includes(NotificationChannel.EMAIL) && !emailEnabled) {
    finalChannels = finalChannels.filter(c => c !== NotificationChannel.EMAIL);
  }

  // If both channels are disabled, skip notification
  if (finalChannels.length === 0) {
    return null;
  }

  return Notification.create({
    receiverUserId,
    typeCode,
    title,
    content,
    channels: finalChannels,
    status: NotificationStatus.UNREAD,
    emailStatus: {
      status: finalChannels.includes(NotificationChannel.EMAIL) ? emailStatus : EmailDeliveryStatus.NOT_REQUIRED,
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
