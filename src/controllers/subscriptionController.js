// controllers/subscriptionController.js
// Nghiệp vụ quản lý vòng đời subscription theo spec v2.0:
//   §6 — Renew (gia hạn: cộng dồn expiredAt, KHÔNG khấu trừ)
//   §7 — Activate Trial (kích hoạt Trial đã cấp sẵn cho user mới)
//   §8 — Cancel (hủy gói đang dùng, có thể hoàn tiền theo policy)

import mongoose from 'mongoose';
import UserServicePackage from '../models/userServicePackageModels.js';
import ServicePackage from '../models/servicePackageModels.js';
import Wallet from '../models/walletModels.js';
import Transaction from '../models/transactionModels.js';
import CvBoost from '../models/cvBoostModels.js';
import JobBoost from '../models/jobBoostModels.js';
import UploadedCV from '../models/uploadedCvModels.js';
import Job from '../models/jobModels.js';
import User from '../models/userModels.js';
import {
  PaymentMethod,
  TransactionStatus,
  TransactionType,
  UserServicePackageStatus,
  ServicePackageType,
  PackageTargetType,
  CvUnlockCreditStatus
} from '../enums/paymentEnums.js';
import { UserRole } from '../enums/userEnums.js';
import { notifyPackagePurchaseSuccess, notifyPaymentCancelled } from '../services/paymentNotificationService.js';
import { createQRPaymentUrl, generateOrderCode, buildTransferContent } from '../services/sepayService.js';
import CvUnlockCredit from '../models/cvUnlockCreditModels.js';
import { computeSubscriptionUsage } from '../utils/proration.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// ────────────────────────────────────────────────────────────────────────────
// §6. GIA HẠN (Renew)
// ────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/subscriptions/:id/renew
 * Gia hạn subscription hiện tại (cùng packageCode) bằng cách cộng dồn expiredAt.
 * Theo spec v2.0 §6.3:
 *   - KHÔNG tạo UserServicePackage mới
 *   - KHÔNG khấu trừ giá trị còn lại
 *   - expiredAt mới = expiredAt cũ + newPkg.durationDays
 *   - pricePaid cộng dồn
 */
export const renewSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { packageId, paymentMethod: requestedMethod = 'WALLET' } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'ID subscription không hợp lệ' });
    }

    const sub = await UserServicePackage.findOne({ _id: id, userId });
    if (!sub) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy subscription' });
    }
    if (sub.status !== UserServicePackageStatus.ACTIVE) {
      return res.status(400).json({ success: false, code: 'SUBSCRIPTION_NOT_ACTIVE', message: 'Subscription không còn hiệu lực' });
    }
    if (!sub.allowRenew) {
      return res.status(400).json({ success: false, code: 'RENEW_NOT_ALLOWED', message: 'Gói này không cho phép gia hạn' });
    }

    const newPkg = await ServicePackage.findById(packageId);
    if (!newPkg || newPkg.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Gói không hợp lệ hoặc không ACTIVE' });
    }
    if (newPkg.code !== sub.packageCode) {
      return res.status(400).json({
        success: false,
        code: 'NOT_SAME_PACKAGE',
        message: 'Gia hạn yêu cầu cùng mã gói với gói hiện tại. Để nâng cấp lên gói khác, dùng chức năng Nâng cấp.'
      });
    }
    if (!newPkg.durationDays || newPkg.durationDays <= 0) {
      return res.status(400).json({ success: false, message: 'Gói này không có thời hạn để gia hạn' });
    }

    // ─── Tính giá ───
    const effectivePrice = newPkg.price; // KHÔNG khấu trừ (spec §6.3)
    const newExpiredAt = new Date(new Date(sub.expiredAt).getTime() + newPkg.durationDays * DAY_MS);

    // ─── Phân luồng thanh toán ───
    const paymentMethod = requestedMethod === PaymentMethod.SEPAY
      ? PaymentMethod.SEPAY
      : PaymentMethod.WALLET;

    if (paymentMethod === PaymentMethod.WALLET) {
      const wallet = await Wallet.findOneAndUpdate(
        { userId, balance: { $gte: effectivePrice } },
        { $inc: { balance: -effectivePrice, totalSpent: effectivePrice } },
        { new: true }
      );
      if (!wallet) {
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_BALANCE',
          message: 'Số dư ví không đủ. Vui lòng nạp thêm hoặc chọn thanh toán qua SePay.'
        });
      }

      const balanceAfter = wallet.balance;
      const transaction = await Transaction.create({
        userId,
        walletId: wallet._id,
        type: TransactionType.PACKAGE_PURCHASE,
        amount: effectivePrice,
        currency: newPkg.currency || 'VND',
        status: TransactionStatus.SUCCESS,
        paymentMethod: PaymentMethod.WALLET,
        targetType: sub.targetType,
        targetId: sub.targetId,
        packageId: newPkg._id,
        balanceBefore: balanceAfter + effectivePrice,
        balanceAfter,
        description: `Gia hạn ${newPkg.name} thêm ${newPkg.durationDays} ngày`,
        metadata: { paidAt: new Date(), renewFromSubscriptionId: sub._id }
      });

      // Cập nhật subscription HIỆN TẠI (không tạo mới)
      sub.expiredAt = newExpiredAt;
      sub.pricePaid = (sub.pricePaid || 0) + effectivePrice;
      await sub.save();

      // Đồng bộ side-effects
      await syncSideEffectsAfterRenew(sub, newExpiredAt);

      // Notify
      notifyPackagePurchaseSuccess({
        userId,
        transaction,
        pkg: newPkg,
        endAt: newExpiredAt
      });

      return res.status(200).json({
        success: true,
        data: {
          method: PaymentMethod.WALLET,
          subscriptionId: sub._id,
          transactionId: transaction._id,
          amount: effectivePrice,
          newExpiredAt,
          daysAdded: newPkg.durationDays,
          newBalance: balanceAfter
        }
      });
    }

    // ─── SEPAY FLOW ───
    const transaction = await Transaction.create({
      userId,
      type: TransactionType.PACKAGE_PURCHASE,
      amount: effectivePrice,
      currency: newPkg.currency || 'VND',
      status: TransactionStatus.PENDING,
      paymentMethod: PaymentMethod.SEPAY,
      targetType: sub.targetType,
      targetId: sub.targetId,
      packageId: newPkg._id,
      packageSnapshot: {
        id: newPkg._id,
        code: newPkg.code,
        name: newPkg.name,
        type: newPkg.packageType,
        price: newPkg.price,
        durationDays: newPkg.durationDays
      },
      description: `Gia hạn ${newPkg.name} thêm ${newPkg.durationDays} ngày`,
      metadata: {
        renewFromSubscriptionId: sub._id,
        isRenew: true
      }
    });

    const orderCode = generateOrderCode(transaction._id.toString());
    transaction.metadata = { ...transaction.metadata, orderCode };
    await transaction.save();

    const bankAccount = process.env.SEPAY_BANK_ACCOUNT || '1017588888';
    const bankName = process.env.SEPAY_BANK_NAME || 'Vietcombank';
    const qrUrl = createQRPaymentUrl({
      account: bankAccount,
      bank: bankName,
      amount: effectivePrice,
      orderCode
    });
    const transferContent = buildTransferContent(orderCode);

    return res.status(200).json({
      success: true,
      data: {
        method: PaymentMethod.SEPAY,
        subscriptionId: sub._id,
        transactionId: transaction._id,
        orderCode,
        amount: effectivePrice,
        newExpiredAt,
        daysAdded: newPkg.durationDays,
        qrUrl,
        transferContent,
        bankAccount,
        bankName
      }
    });
  } catch (error) {
    console.error('renewSubscription error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Đồng bộ side-effects sau khi renew: cập nhật boostedUntil / premium.expiredAt.
 * KHÔNG tạo boost mới (giữ nguyên record cũ) — chỉ kéo dài expiration.
 */
async function syncSideEffectsAfterRenew(sub, newExpiredAt) {
  if (sub.targetType === PackageTargetType.CV) {
    await CvBoost.updateMany(
      { cvId: sub.targetId, status: UserServicePackageStatus.ACTIVE },
      { $set: { endAt: newExpiredAt } }
    );
    await UploadedCV.updateOne(
      { _id: sub.targetId },
      { $set: { isBoosted: true, boostedUntil: newExpiredAt } }
    );
  } else if (sub.targetType === PackageTargetType.JOB) {
    await JobBoost.updateMany(
      { jobId: sub.targetId, status: UserServicePackageStatus.ACTIVE },
      { $set: { endAt: newExpiredAt } }
    );
    await Job.updateOne(
      { _id: sub.targetId },
      { $set: { 'premium.expiredAt': newExpiredAt } }
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// §7. ACTIVATE TRIAL
// ────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/trial/activate
 * Body: { targetType: 'CV' | 'JOB', targetId: string }
 *
 * User mới được auto-grant trialAvailable=true + hasUsedTrial=true (xem authController).
 * Khi user upload CV đầu tiên / đăng Job đầu tiên, FE gọi endpoint này để kích hoạt Trial.
 * Theo spec v2.0 §7.3.
 */
export const activateTrial = async (req, res) => {
  try {
    const userId = req.user._id;
    const { targetType, targetId } = req.body;

    if (!targetType || !targetId) {
      return res.status(400).json({ success: false, message: 'Thiếu targetType hoặc targetId' });
    }
    if (!['CV', 'JOB'].includes(targetType)) {
      return res.status(400).json({ success: false, message: 'targetType chỉ chấp nhận CV hoặc JOB' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }
    if (!user.trialAvailable || user.hasUsedTrial === false) {
      return res.status(400).json({
        success: false,
        code: 'NO_TRIAL_AVAILABLE',
        message: 'Bạn không có Trial khả dụng hoặc đã sử dụng rồi.'
      });
    }

    // ─── Tìm ServicePackage Trial tương ứng ───
    const trialCode = targetType === 'CV' ? 'BOOST_CV_TRIAL' : 'JOB_TRIAL';
    const pkg = await ServicePackage.findOne({
      code: trialCode,
      status: 'ACTIVE',
      isFreeTrial: true
    });
    if (!pkg) {
      return res.status(500).json({
        success: false,
        message: `Gói Trial ${trialCode} chưa được cấu hình trong hệ thống. Liên hệ admin.`
      });
    }

    // ─── Validate target ownership ───
    if (targetType === 'CV') {
      const cv = await UploadedCV.findOne({ _id: targetId, userId });
      if (!cv) {
        return res.status(404).json({ success: false, message: 'CV không tồn tại hoặc không thuộc quyền sở hữu' });
      }
    } else {
      const job = await Job.findOne({ _id: targetId, createdBy: userId });
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job không tồn tại hoặc không thuộc quyền sở hữu' });
      }
    }

    // ─── Check target chưa có subscription ACTIVE cùng loại ───
    const existingActive = await UserServicePackage.findOne({
      userId,
      targetType,
      targetId,
      status: UserServicePackageStatus.ACTIVE
    });
    if (existingActive) {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_HAS_ACTIVE_PACKAGE',
        message: 'Target này đã có gói đang hoạt động.'
      });
    }

    // ─── Tạo subscription Trial ───
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + pkg.durationDays * DAY_MS);

    const subscription = await UserServicePackage.create({
      userId,
      packageId: pkg._id,
      packageSnapshot: {
        id: pkg._id,
        code: pkg.code,
        name: pkg.name,
        type: pkg.packageType,
        price: pkg.price,
        durationDays: pkg.durationDays
      },
      packageCode: pkg.code,
      packageType: pkg.packageType,
      targetType,
      targetId,
      startedAt: startAt,
      expiredAt: endAt,
      status: UserServicePackageStatus.ACTIVE,
      pricePaid: 0,
      currency: pkg.currency || 'VND',
      // Trial → không qua transaction
      transactionId: new mongoose.Types.ObjectId(),
      allowRenew: false,
      allowUpgrade: false
    });

    // ─── Side-effects (copy từ jobseekerBoostController / employerBoostController) ───
    if (targetType === 'CV') {
      await CvBoost.create({
        cvId: targetId,
        userId,
        packageId: pkg._id,
        startAt,
        endAt,
        status: UserServicePackageStatus.ACTIVE
      });
      await UploadedCV.updateOne(
        { _id: targetId },
        { $set: { isBoosted: true, boostedUntil: endAt } }
      );
    } else if (targetType === 'JOB') {
      await JobBoost.create({
        jobId: targetId,
        employerId: userId,
        packageId: pkg._id,
        startAt,
        endAt,
        status: UserServicePackageStatus.ACTIVE
      });
      await Job.updateOne(
        { _id: targetId },
        {
          $set: {
            'premium.isActive': true,
            'premium.startedAt': startAt,
            'premium.expiredAt': endAt,
            isUrgent: true
          }
        }
      );
    }

    // ─── Mark trial consumed ───
    user.trialAvailable = false;
    await user.save();

    return res.status(201).json({
      success: true,
      data: {
        subscriptionId: subscription._id,
        packageName: pkg.name,
        targetType,
        targetId,
        startedAt: startAt,
        expiredAt: endAt,
        isFreeTrial: true,
        pricePaid: 0
      }
    });
  } catch (error) {
    console.error('activateTrial error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────
// §8. HỦY GÓI (Cancel)
// ────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/subscriptions/:id/cancel
 *
 * Spec v2.0 §8.1:
 *   - Trường hợp 1: Đã thanh toán nhưng chưa kích hoạt → hoàn 100%
 *   - Trường hợp 2: Đang sử dụng → không hoàn (mặc định)
 *
 * Spec v2.0 §8.2 (tùy chọn - có thể bật/tắt qua env ENABLE_REFUND_POLICY):
 *   - Hủy trong 24h đầu, chưa dùng gì: hoàn 80%
 *   - Hủy trong 7 ngày đầu, dùng < 20%: hoàn 50%
 *   - Sau 7 ngày hoặc dùng ≥ 20%: hoàn 0%
 */
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'ID subscription không hợp lệ' });
    }

    const sub = await UserServicePackage.findOne({ _id: id, userId });
    if (!sub) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy subscription' });
    }
    if (sub.status === UserServicePackageStatus.CANCELLED) {
      return res.status(400).json({ success: false, code: 'ALREADY_CANCELLED', message: 'Gói đã được hủy trước đó' });
    }
    if (sub.status === UserServicePackageStatus.EXPIRED) {
      return res.status(400).json({ success: false, code: 'ALREADY_EXPIRED', message: 'Gói đã hết hạn, không thể hủy' });
    }

    // ─── Tính refund theo policy (nếu bật) ───
    const enableRefundPolicy = process.env.ENABLE_REFUND_POLICY === 'true';
    let refundAmount = 0;
    let refundPercent = 0;

    if (enableRefundPolicy) {
      const usage = computeSubscriptionUsage(sub);
      const startedAt = new Date(sub.startedAt).getTime();
      const hoursElapsed = (Date.now() - startedAt) / (1000 * 60 * 60);

      if (hoursElapsed <= 24 && usage.usedRatio < 0.05) {
        refundPercent = 0.80;
      } else if (hoursElapsed <= 24 * 7 && usage.usedRatio < 0.20) {
        refundPercent = 0.50;
      } else {
        refundPercent = 0;
      }

      refundAmount = Math.round((sub.pricePaid || 0) * refundPercent);
    }

    // ─── Hủy subscription ───
    sub.status = UserServicePackageStatus.CANCELLED;
    sub.cancelledAt = new Date();
    sub.cancelledReason = reason || 'USER_CANCELLED';
    await sub.save();

    // ─── Tắt side-effects ───
    await deactivateSideEffects(sub);

    // ─── Hoàn tiền vào ví (nếu có refund) ───
    if (refundAmount > 0) {
      const wallet = await Wallet.findOneAndUpdate(
        { userId },
        { $inc: { balance: refundAmount } },
        { new: true }
      );

      await Transaction.create({
        userId,
        walletId: wallet?._id,
        type: TransactionType.REFUND,
        amount: refundAmount,
        currency: sub.currency || 'VND',
        status: TransactionStatus.SUCCESS,
        paymentMethod: PaymentMethod.WALLET,
        description: `Hoàn tiền hủy gói ${sub.packageCode} (${Math.round(refundPercent * 100)}%)`,
        metadata: {
          subscriptionId: sub._id,
          refundPercent,
          originalPricePaid: sub.pricePaid
        }
      });
    }

    // ─── Notify ───
    notifyPaymentCancelled({
      userId,
      transaction: { amount: sub.pricePaid, packageCode: sub.packageCode },
      reason: reason || 'Người dùng tự hủy'
    });

    return res.status(200).json({
      success: true,
      data: {
        subscriptionId: sub._id,
        status: sub.status,
        cancelledAt: sub.cancelledAt,
        refundAmount,
        refundPercent: refundPercent ? Math.round(refundPercent * 100) : 0,
        message: refundAmount > 0
          ? `Đã hủy gói và hoàn ${refundAmount.toLocaleString('vi-VN')}đ vào ví`
          : 'Đã hủy gói thành công'
      }
    });
  } catch (error) {
    console.error('cancelSubscription error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Tắt toàn bộ side-effects khi hủy subscription.
 */
async function deactivateSideEffects(sub) {
  if (sub.targetType === PackageTargetType.CV) {
    await CvBoost.updateMany(
      { cvId: sub.targetId, status: UserServicePackageStatus.ACTIVE },
      { $set: { status: UserServicePackageStatus.CANCELLED } }
    );
    await UploadedCV.updateOne(
      { _id: sub.targetId },
      { $set: { isBoosted: false, boostedUntil: null } }
    );
  } else if (sub.targetType === PackageTargetType.JOB) {
    await JobBoost.updateMany(
      { jobId: sub.targetId, status: UserServicePackageStatus.ACTIVE },
      { $set: { status: UserServicePackageStatus.CANCELLED } }
    );
    await Job.updateOne(
      { _id: sub.targetId, createdBy: sub.userId },
      {
        $set: {
          'premium.isActive': false,
          'premium.deactivatedAt': new Date(),
          'premium.deactivatedReason': 'CANCELLED',
          isUrgent: false
        }
      }
    );
  }
}