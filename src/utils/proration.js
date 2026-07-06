// utils/proration.js
// Tính toán khấu trừ giá trị còn lại khi nâng cấp gói (Upgrade).
//
// Spec nghiệp vụ v2.0 §5.3:
//   - Jobseeker Boost: refund = timeBasedRefund (full)
//   - Employer Premium Job: refund = min(timeBasedRefund, pricePaid × refundCapRatio) — cap theo gói
//   - Unlock Bundle: KHÔNG cho upgrade (refund = 0, canUpgrade = false)
//
// Mục đích tách file: code trước copy logic giống nhau vào 2 controller
// (jobseekerBoostController + employerBoostController) → drift, dễ sai. Gom về đây.

import { ServicePackageType } from '../enums/paymentEnums.js';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Tính các giá trị cơ bản từ subscription ACTIVE: ngày còn lại, tổng ngày, tỷ lệ đã dùng.
 * Tách ra để 2 hàm compute bên dưới dùng chung.
 *
 * @param {Object} activeSub - UserServicePackage document có startedAt, expiredAt, pricePaid
 * @returns {Object} { daysRemaining, totalDays, remainingMs, totalMs, usedRatio }
 */
export const computeSubscriptionUsage = (activeSub) => {
  const startedAt = new Date(activeSub.startedAt).getTime();
  const expiredAt = new Date(activeSub.expiredAt).getTime();
  const now = Date.now();

  const totalMs = Math.max(1, expiredAt - startedAt);
  const remainingMs = Math.max(0, expiredAt - now);
  const usedMs = Math.max(0, totalMs - remainingMs);

  const totalDaysFloat = totalMs / MS_PER_DAY;
  const remainingDaysFloat = remainingMs / MS_PER_DAY;

  return {
    totalMs,
    remainingMs,
    usedMs,
    daysRemaining: Math.max(0, Math.ceil(remainingDaysFloat)),
    totalDays: Math.max(1, Math.ceil(totalDaysFloat)),
    // Tỷ lệ đã dùng (0 → 1). Dùng để check upgradeMaxUsedRatio.
    usedRatio: Math.min(1, Math.max(0, usedMs / totalMs))
  };
};

/**
 * Tính giá trị còn lại của gói cũ theo thời gian (dùng chung cho cả 2 hàm compute bên dưới).
 *
 * @param {number} pricePaid - Số tiền đã trả cho gói cũ
 * @param {number} remainingMs - Thời gian còn lại (ms)
 * @param {number} totalMs - Tổng thời gian gói (ms)
 * @returns {number} Giá trị còn lại (VND, đã round)
 */
const computeTimeBasedRefund = (pricePaid, remainingMs, totalMs) => {
  if (pricePaid <= 0 || totalMs <= 0) return 0;
  // Chia trước rồi nhân để giảm sai số float (vd: 30 ngày × 86.400.000 ms = rất lớn)
  const dailyPrice = pricePaid / (totalMs / MS_PER_DAY);
  return Math.max(0, Math.round(dailyPrice * (remainingMs / MS_PER_DAY)));
};

/**
 * Compute upgrade cho JOBSEEKER (Boost CV) — full time-based refund (spec §5.3).
 *
 * @param {Object} activeSub - UserServicePackage ACTIVE hiện tại
 * @param {Object} newPkg - ServicePackage muốn nâng cấp lên
 * @returns {Object} { daysRemaining, totalDays, remainingValue, upgradePrice, downgrade, canUpgrade, tooMuchUsed }
 */
export const computeJobseekerUpgradeQuote = (activeSub, newPkg) => {
  const usage = computeSubscriptionUsage(activeSub);
  const timeBasedRefund = computeTimeBasedRefund(activeSub.pricePaid, usage.remainingMs, usage.totalMs);

  return {
    daysRemaining: usage.daysRemaining,
    totalDays: usage.totalDays,
    usedRatio: usage.usedRatio,
    remainingValue: timeBasedRefund, // Jobseeker: full refund
    refundCap: timeBasedRefund,
    upgradePrice: Math.max(0, newPkg.price - timeBasedRefund),
    downgrade: newPkg.price < timeBasedRefund,
    canUpgrade: !newPkg.price < timeBasedRefund, // Jobseeker không cap, chỉ cần gói mới giá cao hơn refund
    tooMuchUsed: usage.usedRatio >= 0.5
  };
};

/**
 * Compute upgrade cho EMPLOYER (Premium Job) — có cap refund theo `refundCapRatio` (spec §5.3).
 *
 * Mặc định `refundCapRatio = 0.30` (chỉ hoàn tối đa 30% giá gói cũ) → chống lỗ khi employer
 * upgrade lên gói đắt tiền sau khi dùng ít.
 *
 * @param {Object} activeSub - UserServicePackage ACTIVE hiện tại
 * @param {Object} newPkg - ServicePackage muốn nâng cấp lên
 * @param {number} [capRatio] - Override cap ratio (mặc định lấy từ activeSub.packageSnapshot.refundCapRatio hoặc 0.30)
 * @returns {Object} { daysRemaining, totalDays, remainingValue, refundCap, upgradePrice, downgrade, canUpgrade, tooMuchUsed }
 */
export const computeEmployerUpgradeQuote = (activeSub, newPkg, capRatio = null) => {
  const usage = computeSubscriptionUsage(activeSub);
  const timeBasedRefund = computeTimeBasedRefund(activeSub.pricePaid, usage.remainingMs, usage.totalMs);

  // Lấy cap ratio: ưu tiên tham số truyền vào, fallback snapshot, fallback 0.30
  const effectiveCap = capRatio
    ?? activeSub.packageSnapshot?.refundCapRatio
    ?? 0.30;
  const refundCap = Math.round(activeSub.pricePaid * effectiveCap);

  // Refund thực tế = min(time-based, cap)
  const remainingValue = Math.min(timeBasedRefund, refundCap);

  return {
    daysRemaining: usage.daysRemaining,
    totalDays: usage.totalDays,
    usedRatio: usage.usedRatio,
    timeBasedRefund,
    remainingValue,
    refundCap,
    capRatio: effectiveCap,
    upgradePrice: Math.max(0, newPkg.price - remainingValue),
    downgrade: newPkg.price < remainingValue,
    canUpgrade: newPkg.price > remainingValue && !usage.usedRatio >= 0.5,
    tooMuchUsed: usage.usedRatio >= 0.5
  };
};

/**
 * Router: chọn hàm compute upgrade phù hợp với packageType + targetRole.
 * Employer Premium Job → computeEmployerUpgradeQuote (cap 30%)
 * Jobseeker Boost → computeJobseekerUpgradeQuote (full refund)
 * Unlock Bundle → trả về object với canUpgrade=false (gọi controller chặn)
 *
 * @param {Object} activeSub
 * @param {Object} newPkg
 * @returns {Object}
 */
export const computeUpgradeQuoteByPackage = (activeSub, newPkg) => {
  if (newPkg.packageType === ServicePackageType.CV_UNLOCK
      || newPkg.packageType === ServicePackageType.CV_UNLOCK_BUNDLE) {
    return {
      canUpgrade: false,
      downgrade: false,
      tooMuchUsed: false,
      remainingValue: 0,
      refundCap: 0,
      upgradePrice: newPkg.price,
      daysRemaining: 0,
      totalDays: 0,
      reason: 'NOT_ALLOWED'
    };
  }

  if (newPkg.targetRole === 'JOBSEEKER' || newPkg.packageType === ServicePackageType.CV_BOOST) {
    return computeJobseekerUpgradeQuote(activeSub, newPkg);
  }

  // Mặc định: Employer Premium Job (và các loại khác nếu có)
  return computeEmployerUpgradeQuote(activeSub, newPkg);
};

/**
 * Đọc số lượt (credits) mà 1 gói unlock cấp — lấy giá trị DƯƠNG đầu tiên.
 * Spec v2.0 dùng `unlockCvCount`, schema cũ dùng `cvAccessLimit`, fallback `quantity` → 1.
 *
 * LƯU Ý: KHÔNG dùng `??` vì `unlockCvCount` có default=0 trong schema → `0 ?? x` trả 0,
 * khiến gói dùng `cvAccessLimit` bị cấp nhầm 0 lượt. Phải bỏ qua các giá trị 0.
 */
export const getPackageCredits = (pkg) => {
  const b = pkg?.benefits || {};
  return (b.unlockCvCount > 0 && b.unlockCvCount)
    || (b.cvAccessLimit > 0 && b.cvAccessLimit)
    || (pkg?.quantity > 0 && pkg.quantity)
    || 1;
};

/**
 * Compute upgrade cho gói UNLOCK theo-LƯỢT (usage-based). Chống lỗ tuyệt đối:
 * chỉ hoàn giá trị cho lượt CHƯA dùng, không cap cần thiết.
 *
 *   remainingValue = pricePaid × (remainingCredits / totalCredits)
 *   upgradePrice   = max(0, newPkg.price − remainingValue)
 *
 * @param {Object} oldBag - CvUnlockCredit ACTIVE hiện tại (có totalCredits, remainingCredits)
 * @param {number} pricePaid - Số tiền đã trả cho túi cũ (từ Transaction gốc)
 * @param {Object} newPkg - ServicePackage muốn nâng cấp lên
 * @returns {Object} { totalCredits, remainingCredits, remainingValue, newCredits, upgradePrice, downgrade }
 */
export const computeCreditUpgradeQuote = (oldBag, pricePaid, newPkg) => {
  const totalCredits = Math.max(1, oldBag.totalCredits || 1);
  const remainingCredits = Math.max(0, Math.min(oldBag.remainingCredits || 0, totalCredits));
  const safePrice = Math.max(0, pricePaid || 0);

  // Chỉ hoàn phần lượt chưa dùng → không thể "rút ruột rồi đòi tiền"
  const remainingValue = Math.round(safePrice * (remainingCredits / totalCredits));
  const newCredits = getPackageCredits(newPkg);

  return {
    totalCredits,
    remainingCredits,
    remainingValue,
    newCredits,
    upgradePrice: Math.max(0, newPkg.price - remainingValue),
    downgrade: newPkg.price < remainingValue
  };
};

/**
 * Check xem gói mới có phải là "cùng gói" với gói cũ không (dùng cho Renew).
 *
 * @param {Object} activeSub
 * @param {Object} newPkg
 * @returns {boolean}
 */
export const isSamePackage = (activeSub, newPkg) => {
  if (!activeSub || !newPkg) return false;
  return activeSub.packageCode === newPkg.code;
};