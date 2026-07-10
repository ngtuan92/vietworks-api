// controllers/expireNotifyController.js
// Controller TÁCH RIÊNG cho 2 cron job (spec v2.0 §12.1):
//   1) expirePremiumServices — chạy 00:00 daily, set EXPIRED cho gói hết hạn
//   2) notifyExpiringSoon    — chạy 09:00 daily, notify gói sắp hết hạn (3 ngày trước)
//
// Đã có sẵn expirePremiumServices trong cronController (gộp cả 2 phase).
// File này EXPORT lại expirePremiumServices + thêm notifyExpiringSoonOnly
// để FE/scheduler có thể gọi TỪNG cron riêng biệt (không bị phụ thuộc phase 1).

import CvBoost from '../models/cvBoostModels.js';
import JobBoost from '../models/jobBoostModels.js';
import UserServicePackage from '../models/userServicePackageModels.js';
import ServicePackage from '../models/servicePackageModels.js';
import Job from '../models/jobModels.js';
import UploadedCV from '../models/uploadedCvModels.js';
import { UserServicePackageStatus } from '../enums/paymentEnums.js';
import {
  notifyPackageExpiringSoon,
  notifyPackageExpired
} from '../services/paymentNotificationService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 3;

/**
 * POST/PATCH /api/system/cron/expire-premium-services
 * Đã có sẵn trong cronController — re-export để scheduler có 1 endpoint duy nhất.
 */
export { expirePremiumServices } from './cronController.js';

/**
 * POST/PATCH /api/system/cron/notify-expiring-soon
 * Chỉ chạy phase notify (không expire). Dùng khi scheduler muốn tách 2 phase:
 *   - 00:00: gọi expirePremiumServices (set EXPIRED + notify đã hết hạn)
 *   - 09:00: gọi notifyExpiringSoonOnly (nhắc trước 3 ngày)
 */
export const notifyExpiringSoonOnly = async (req, res) => {
  try {
    const now = new Date();
    const threshold = new Date(now.getTime() + EXPIRING_SOON_DAYS * DAY_MS);

    const subs = await UserServicePackage.find({
      status: UserServicePackageStatus.ACTIVE,
      expiredAt: { $gt: now, $lte: threshold },
      'metadata.notifiedExpiringSoonAt': { $exists: false }
    }).lean();

    let notified = 0;
    for (const sub of subs) {
      let pkg = await ServicePackage.findById(sub.packageId).select('name code durationDays').lean();
      if (!pkg && sub.packageCode) {
        pkg = await ServicePackage.findOne({ code: sub.packageCode }).select('name code durationDays').lean();
      }
      const daysLeft = Math.max(
        1,
        Math.ceil((new Date(sub.expiredAt).getTime() - now.getTime()) / DAY_MS)
      );
      await notifyPackageExpiringSoon({
        userId: sub.userId,
        subscription: sub,
        pkg,
        daysLeft
      });
      await UserServicePackage.updateOne(
        { _id: sub._id },
        { $set: { 'metadata.notifiedExpiringSoonAt': now } }
      );
      notified++;
    }

    res.status(200).json({
      success: true,
      data: {
        expiringSoonNotified: notified,
        executedAt: now
      }
    });
  } catch (error) {
    console.error('notifyExpiringSoonOnly error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};