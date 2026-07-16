// controllers/expireNotifyController.js
// Thông báo gói hết hạn / sắp hết hạn (spec v2.0 §12.1) — tách kênh in-app vs email,
// đều do CRON tạo (ném notification vào DB); web hiển thị khi user vào trang, socket
// đẩy realtime nếu đang online:
//   - expirePremiumServices  : cron 08:00 — set EXPIRED + thông báo "đã hết hạn" (1 lần)
//   - notifyExpiringSoonOnly  : dùng cho 2 cron —
//        07:00 tạo IN-APP "sắp hết hạn" (≤ 3 ngày)  [slot 'web',  channels=inapp]
//        09:00 gửi EMAIL   "sắp hết hạn" (≤ 2 ngày)  [slot 'email', channels=email]
//
// Chống trùng theo (NGÀY + SLOT) qua metadata.expiringSoonNotifiedKeys:
//   slot 'web' và 'email' tách riêng → mỗi kênh tạo tối đa 1 lần/ngày.

import UserServicePackage from '../models/userServicePackageModels.js';
import ServicePackage from '../models/servicePackageModels.js';
import { notifyPackageExpiringSoon } from '../services/paymentNotificationService.js';
import { NotificationChannel } from '../enums/notificationEnums.js';
import { UserServicePackageStatus } from '../enums/paymentEnums.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 3;

/**
 * Xử lý chung: tìm gói ACTIVE sắp hết hạn trong `days` ngày, chưa gửi cho slot hôm nay,
 * gửi thông báo theo `channels`, rồi ghi nhận key chống trùng.
 * @returns {number} số gói đã gửi
 */
async function processExpiringSoon({ userId, days, channels, slot, now }) {
  const threshold = new Date(now.getTime() + days * DAY_MS);
  const slotKey = `${now.toISOString().slice(0, 10)}:${slot}`; // YYYY-MM-DD:slot

  const filter = {
    status: UserServicePackageStatus.ACTIVE,
    expiredAt: { $gt: now, $lte: threshold },
    'metadata.expiringSoonNotifiedKeys': { $ne: slotKey }
  };
  if (userId) filter.userId = userId;

  const subs = await UserServicePackage.find(filter).lean();

  let notified = 0;
  for (const sub of subs) {
    let pkg = await ServicePackage.findById(sub.packageId).select('name code durationDays').lean();
    if (!pkg && sub.packageCode) {
      pkg = await ServicePackage.findOne({ code: sub.packageCode }).select('name code durationDays').lean();
    }
    const daysLeft = Math.max(1, Math.ceil((new Date(sub.expiredAt).getTime() - now.getTime()) / DAY_MS));
    await notifyPackageExpiringSoon({ userId: sub.userId, subscription: sub, pkg, daysLeft, channels });
    await UserServicePackage.updateOne(
      { _id: sub._id },
      { $addToSet: { 'metadata.expiringSoonNotifiedKeys': slotKey } }
    );
    notified++;
  }
  return notified;
}

/**
 * PATCH /api/system/cron/expire-premium-services — re-export (giữ 1 endpoint duy nhất).
 */
export { expirePremiumServices } from './cronController.js';

/**
 * PATCH /api/system/cron/notify-expiring-soon
 * Cron 09:00: gửi EMAIL "sắp hết hạn". Query:
 *   ?days=2 (mặc định 3) · ?slot=email · ?channels=email|inapp (mặc định cả 2)
 */
export const notifyExpiringSoonOnly = async (req, res) => {
  try {
    const now = new Date();
    const days = parseInt(req.query?.days, 10) || EXPIRING_SOON_DAYS;
    const slot = req.query?.slot || 'default';
    const channels =
      req.query?.channels === 'email' ? [NotificationChannel.EMAIL]
        : req.query?.channels === 'inapp' ? [NotificationChannel.IN_APP]
          : undefined; // undefined → gửi cả 2 kênh

    const notified = await processExpiringSoon({ days, channels, slot, now });
    res.status(200).json({ success: true, data: { slot, days, expiringSoonNotified: notified, executedAt: now } });
  } catch (error) {
    console.error('notifyExpiringSoonOnly error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
