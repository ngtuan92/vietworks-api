import { Notification } from '../models/index.js';
import User from '../models/userModels.js';
import JobseekerProfile from '../models/jobseekerProfileModels.js';
import {
  EmailDeliveryStatus,
  NotificationChannel,
  NotificationStatus,
  NotificationTypeCode
} from '../enums/notificationEnums.js';
import { sendBusinessEmail, sendCvViewedEmail } from './emailService.js';

export const createNotification = async ({
  receiverUserId,
  typeCode,
  title,
  content,
  channels = [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  metadata = {},
  emailStatus = EmailDeliveryStatus.NOT_REQUIRED
}) => {
  if (!receiverUserId || !typeCode || !title || !content) {
    throw new Error('Thiếu dữ liệu bắt buộc để tạo thông báo');
  }

  const [user, jsProfile] = await Promise.all([
    User.findById(receiverUserId).select('email fullName notificationSettings').lean(),
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

  const shouldSendEmail = finalChannels.includes(NotificationChannel.EMAIL);

  const notification = await Notification.create({
    receiverUserId,
    typeCode,
    title,
    content,
    channels: finalChannels,
    status: NotificationStatus.UNREAD,
    emailStatus: {
      status: shouldSendEmail ? EmailDeliveryStatus.PENDING : EmailDeliveryStatus.NOT_REQUIRED,
      sentAt: null,
      failedReason: null
    },
    metadata
  });

  // Gửi email nền (non-blocking) nếu kênh EMAIL được bật
  if (shouldSendEmail && user?.email) {
    let emailPromise = null;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    if (typeCode === NotificationTypeCode.EMPLOYER_VIEWED_CV) {
      emailPromise = sendCvViewedEmail({
        receiverUserId,
        toEmail: user.email,
        jobseekerName: user.fullName,
        companyName: metadata.companyName,
        jobTitle: metadata.jobTitle,
        companyLogo: metadata.companyLogo,
        jobUrl: `${clientUrl}/jobs/${metadata.jobId}`,
        notificationId: notification._id
      });
    } else {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #1f2937; max-width: 600px; margin: 0 auto;">
          <div style="background: #003f87; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 20px;">VietWorks</h1>
          </div>
          <div style="background: #f9fafb; padding: 28px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #003f87;">${title}</h2>
            <p>Xin chào <strong>${user.fullName || 'bạn'}</strong>,</p>
            <p>${content}</p>
            <p style="margin-top: 24px;">Trân trọng,<br /><strong>Đội ngũ VietWorks</strong></p>
          </div>
        </div>
      `;

      emailPromise = sendBusinessEmail({
        receiverUserId,
        toEmail: user.email,
        subject: `VietWorks - ${title}`,
        html: emailHtml,
        notificationId: notification._id
      });
    }

    emailPromise.then(log => {
      const update = { 'emailStatus.status': log.status };
      if (log.status === EmailDeliveryStatus.SENT) {
        update['emailStatus.sentAt'] = log.sentAt;
      } else if (log.status === EmailDeliveryStatus.FAILED) {
        update['emailStatus.failedReason'] = log.failedReason;
      }
      Notification.findByIdAndUpdate(notification._id, { $set: update }).exec();
    }).catch(() => {});
  }

  return notification;
};

const NotificationService = {
  create: createNotification
};

export default NotificationService;
