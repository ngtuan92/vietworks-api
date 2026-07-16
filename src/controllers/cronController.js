import CvBoost from '../models/cvBoostModels.js';
import JobBoost from '../models/jobBoostModels.js';
import UserServicePackage from '../models/userServicePackageModels.js';
import ServicePackage from '../models/servicePackageModels.js';
import Job from '../models/jobModels.js';
import UploadedCV from '../models/uploadedCvModels.js';
import { UserServicePackageStatus } from '../enums/paymentEnums.js';
import { notifyPackageExpiringSoon, notifyPackageExpired } from '../services/paymentNotificationService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 3;

export const expirePremiumServices = async (req, res) => {
  try {
    const now = new Date();
    const expiringSoonThreshold = new Date(now.getTime() + EXPIRING_SOON_DAYS * DAY_MS);

    // ─── 1) Notify gói sắp hết hạn (3 ngày tới, chưa từng notify) ───
    //   Lưu cờ notifiedExpiringSoonAt trên metadata subscription để tránh spam.
    //   Bỏ qua phase này khi ?skipExpiringSoon=1 (cron 00:00 chỉ expire; nhắc sắp hết hạn
    //   để cron 09:00 gọi notifyExpiringSoonOnly cho đẹp — tránh nhắc lúc nửa đêm).
    let expiringSoonNotified = 0;
    if (!req.query?.skipExpiringSoon) {
      const expiringSubs = await UserServicePackage.find({
        status: UserServicePackageStatus.ACTIVE,
        expiredAt: { $gt: now, $lte: expiringSoonThreshold },
        'metadata.notifiedExpiringSoonAt': { $exists: false }
      }).lean();

      for (const sub of expiringSubs) {
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
        // Đánh dấu đã notify để cron lần sau không gửi lại
        await UserServicePackage.updateOne(
          { _id: sub._id },
          { $set: { 'metadata.notifiedExpiringSoonAt': now } }
        );
        expiringSoonNotified++;
      }
    }

    // ─── 2) Snapshot subscription ACTIVE sắp expire TRƯỚC khi flip (để notify khi đã expired) ───
    const aboutToExpireSubs = await UserServicePackage.find({
      status: UserServicePackageStatus.ACTIVE,
      expiredAt: { $lte: now }
    }).lean();

    // ─── 3) Flip sang EXPIRED (3 bảng: CvBoost, JobBoost, UserServicePackage) ───
    const cvResult = await CvBoost.updateMany(
      { status: UserServicePackageStatus.ACTIVE, endAt: { $lte: now } },
      { $set: { status: UserServicePackageStatus.EXPIRED } }
    );

    const jobResult = await JobBoost.updateMany(
      { status: UserServicePackageStatus.ACTIVE, endAt: { $lte: now } },
      { $set: { status: UserServicePackageStatus.EXPIRED } }
    );

    // Đồng bộ Job.premium.isActive = false + isUrgent = false cho các job vừa expire
    await Job.updateMany(
      { 'premium.isActive': true, 'premium.expiredAt': { $lte: now } },
      {
        $set: {
          'premium.isActive': false,
          'premium.deactivatedAt': now,
          'premium.deactivatedReason': 'EXPIRED',
          isUrgent: false
        }
      }
    );

    const uspResult = await UserServicePackage.updateMany(
      { status: UserServicePackageStatus.ACTIVE, expiredAt: { $lte: now } },
      { $set: { status: UserServicePackageStatus.EXPIRED } }
    );

    // Đồng bộ UploadedCV.isBoosted = false cho các CV vừa expire boost
    await UploadedCV.updateMany(
      { isBoosted: true, boostedUntil: { $lte: now } },
      { $set: { isBoosted: false, boostedUntil: null } }
    );

    // ─── 4) Notify PACKAGE_EXPIRED cho từng subscription vừa expire ───
    let expiredNotified = 0;
    for (const sub of aboutToExpireSubs) {
      const pkg = await ServicePackage.findById(sub.packageId).select('name code durationDays').lean();
      await notifyPackageExpired({
        userId: sub.userId,
        subscription: sub,
        pkg
      });
      expiredNotified++;
    }

    res.status(200).json({
      success: true,
      data: {
        cvBoostsExpired: cvResult.modifiedCount,
        jobBoostsExpired: jobResult.modifiedCount,
        userServicePackagesExpired: uspResult.modifiedCount,
        expiringSoonNotified,
        expiredNotified,
        executedAt: now
      }
    });
  } catch (error) {
    console.error('expirePremiumServices error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};