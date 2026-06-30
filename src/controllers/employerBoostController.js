import ServicePackage from '../models/servicePackageModels.js';
import Transaction from '../models/transactionModels.js';
import JobBoost from '../models/jobBoostModels.js';
import Wallet from '../models/walletModels.js';
import Job from '../models/jobModels.js';
import UserServicePackage from '../models/userServicePackageModels.js';
import { ServicePackageType, ServicePackageTargetRole, TransactionType, TransactionStatus, PaymentMethod, UserServicePackageStatus, PackageTargetType } from '../enums/paymentEnums.js';
import { createQRPaymentUrl, generateOrderCode, buildTransferContent } from '../services/sepayService.js';
import { notifyPaymentCancelled, notifyPackagePurchaseSuccess } from '../services/paymentNotificationService.js';

/**
 * Kích hoạt gói PREMIUM_JOB cho 1 Job ngay lập tức (dùng cho cả WALLET lẫn SEPAY-success).
 * Tạo UserServicePackage + JobBoost + cập nhật Job.premium.
 */
const activatePremiumJobPackage = async ({ userId, jobId, pkg, transactionId }) => {
  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + (pkg.durationDays || 7) * 24 * 60 * 60 * 1000);

  // UserServicePackage (source of truth)
  try {
    const existed = await UserServicePackage.findOne({ transactionId });
    if (!existed) {
      await UserServicePackage.create({
        userId,
        packageId: pkg._id,
        // Defensive defaults: mọi field đều có fallback tránh validation error khi
        // ServicePackage thiếu field (vd: gói cũ seed với durationDays=null).
        packageSnapshot: {
          id: pkg._id,
          code: pkg.code ?? null,
          name: pkg.name ?? null,
          type: pkg.packageType ?? null,
          price: pkg.price ?? null,
          durationDays: pkg.durationDays ?? 7
        },
        packageCode: pkg.code ?? null,
        packageType: pkg.packageType ?? null,
        targetType: 'JOB',
        targetId: jobId,
        startedAt: startAt,
        expiredAt: endAt,
        status: UserServicePackageStatus.ACTIVE,
        pricePaid: pkg.price,
        currency: 'VND',
        transactionId
      });
    }
  } catch (err) {
    console.error('Tạo UserServicePackage lỗi (không rollback):', err.message);
  }

  // JobBoost (backward compat)
  const ex = await JobBoost.findOne({ jobId, status: 'ACTIVE' });
  if (!ex) {
    await JobBoost.create({ jobId, employerId: userId, packageId: pkg._id, startAt, endAt });
    await Job.updateOne(
      { _id: jobId, createdBy: userId },
      {
        $set: {
          'premium.isActive': true,
          'premium.startedAt': startAt,
          'premium.expiredAt': endAt,
          'premium.deactivatedAt': null,
          'premium.deactivatedReason': null,
          isUrgent: true
        }
      }
    );
  }

  return { startAt, endAt };
};

/**
 * Tính báo giá nâng cấp gói: giá trị còn lại của gói cũ theo thời gian → số tiền phải bù.
 *
 * Công thức (Cách 1 — nâng cấp theo tư duy "giá mỗi ngày × số ngày còn"):
 *   dailyPrice          = pricePaid / totalDaysFloat     (giá 1 ngày — tính trước)
 *   remainingValue      = round(dailyPrice × daysRemainingFloat)
 *   upgradePrice        = max(0, newPkg.price − remainingValue)
 *
 * Lý do chia trước rồi nhân: với cách cũ `round(pricePaid × ms / totalMs)` thì số trung gian
 * rất lớn (price × 86_400_000 = hàng chục tỷ), dễ mất precision float. Cách này: chia trước
 * để có dailyPrice (≈ 1.666), rồi nhân với số ngày còn (≤ 30) → số trung gian nhỏ → sai số
 * float nhỏ hơn đáng kể, đặc biệt với gói dài hạn (365 ngày).
 *
 * `daysRemainingFloat` & `totalDaysFloat` là float chính xác (không qua ceil) dùng cho value.
 * `daysRemaining` & `totalDays` trả về cho FE làm display (Math.ceil — số ngày dương).
 *
 * Trả về { daysRemaining, totalDays, remainingValue, upgradePrice, downgrade }.
 *   - downgrade = true khi newPkg.price < remainingValue (gói mới rẻ hơn giá trị còn lại
 *     của gói cũ) — FE/BE sẽ chặn không cho nâng cấp.
 */
export const computeUpgradeQuote = (activeSub, newPkg) => {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const now = Date.now();
  const startedAt = new Date(activeSub.startedAt).getTime();
  const expiredAt = new Date(activeSub.expiredAt).getTime();
  const totalMs = Math.max(1, expiredAt - startedAt);
  const remainingMs = Math.max(0, expiredAt - now);

  // Float chính xác cho value computation
  const totalDaysFloat = totalMs / MS_PER_DAY;
  const daysRemainingFloat = remainingMs / MS_PER_DAY;

  // Ceil cho display (FE hiển thị "còn N ngày" số nguyên dương)
  const daysRemaining = Math.max(0, Math.ceil(daysRemainingFloat));
  const totalDays = Math.max(1, Math.ceil(totalDaysFloat));

  // Công thức mới: giá 1 ngày × số ngày còn (chia trước rồi nhân → sai số float nhỏ)
  const dailyPrice = activeSub.pricePaid / totalDaysFloat;
  const remainingValue = Math.round(dailyPrice * daysRemainingFloat);

  const upgradePrice = Math.max(0, newPkg.price - remainingValue);
  const downgrade = newPkg.price < remainingValue;

  return { daysRemaining, totalDays, remainingValue, upgradePrice, downgrade };
};

export const createBoostPayment = async (req, res) => {
  try {
    const employerId = req.user._id;
    const { jobId } = req.params;
    const { packageId, action = 'new', paymentMethod: requestedMethod } = req.body;

    const job = await Job.findOne({ _id: jobId, createdBy: employerId, status: 'PUBLISHED' });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found or not owned' });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (new Date(job.deadline) < startOfToday) {
      return res.status(400).json({ success: false, message: 'Job deadline has passed' });
    }

    const pkg = await ServicePackage.findById(packageId);
    if (!pkg || pkg.packageType !== ServicePackageType.PREMIUM_JOB) {
      return res.status(400).json({ success: false, message: 'Invalid package' });
    }

    // ─── Check user đã có gói ACTIVE cho Job này chưa ───
    const activeSubscription = await UserServicePackage.findOne({
      userId: employerId,
      targetType: PackageTargetType.JOB,
      targetId: jobId,
      status: UserServicePackageStatus.ACTIVE
    }).populate('packageId', 'name code price durationDays');

    // ─── Tính báo giá nâng cấp NGAY TẠI ĐÂY (dùng cho cả hai nhánh action). ───
    let upgradeQuote = null;
    if (activeSubscription) {
      upgradeQuote = computeUpgradeQuote(activeSubscription, pkg);
    }

    if (activeSubscription) {
      if (action !== 'upgrade') {
        return res.status(400).json({
          success: false,
          code: 'ALREADY_HAS_ACTIVE_PACKAGE',
          message: `Tin tuyển dụng đang dùng gói "${activeSubscription.packageId?.name || activeSubscription.packageCode}" (còn ${upgradeQuote.daysRemaining} ngày). Hãy nâng cấp hoặc đợi gói hết hạn.`,
          data: {
            currentPackage: {
              name: activeSubscription.packageId?.name,
              code: activeSubscription.packageCode,
              pricePaid: activeSubscription.pricePaid,
              startedAt: activeSubscription.startedAt,
              expiredAt: activeSubscription.expiredAt,
              totalDays: upgradeQuote.totalDays,
              daysRemaining: upgradeQuote.daysRemaining,
              remainingValue: upgradeQuote.remainingValue
            },
            upgradePrice: upgradeQuote.upgradePrice,
            downgrade: upgradeQuote.downgrade
          }
        });
      }

      // action === 'upgrade': chặn nếu gói mới rẻ hơn giá trị còn lại của gói cũ
      if (upgradeQuote.downgrade) {
        return res.status(400).json({
          success: false,
          code: 'DOWNGRADE_NOT_ALLOWED',
          message: `Không thể nâng cấp lên gói rẻ hơn khi gói hiện tại còn giá trị ${upgradeQuote.remainingValue.toLocaleString('vi-VN')}đ. Vui lòng đợi gói hết hạn hoặc chọn gói có giá cao hơn.`,
          data: {
            currentPackage: {
              name: activeSubscription.packageId?.name,
              pricePaid: activeSubscription.pricePaid,
              daysRemaining: upgradeQuote.daysRemaining,
              remainingValue: upgradeQuote.remainingValue
            },
            newPackage: { name: pkg.name, price: pkg.price },
            upgradePrice: upgradeQuote.upgradePrice
          }
        });
      }

      // action === 'upgrade' + paymentMethod = WALLET: huỷ gói cũ NGAY (instant).
      // action === 'upgrade' + paymentMethod = SEPAY: KHÔNG huỷ gói cũ ở đây — đợi webhook SUCCESS mới huỷ.
      if (requestedMethod === PaymentMethod.WALLET) {
        activeSubscription.status = UserServicePackageStatus.CANCELLED;
        activeSubscription.cancelledAt = new Date();
        activeSubscription.cancelledReason = 'UPGRADED';
        await activeSubscription.save();

        // Notify user rằng subscription cũ đã bị huỷ (kèm giao dịch gốc nếu có)
        if (activeSubscription.transactionId) {
          const oldTxn = await Transaction.findById(activeSubscription.transactionId).lean();
          if (oldTxn) {
            notifyPaymentCancelled({
              userId: employerId,
              transaction: oldTxn,
              reason: 'Đã nâng cấp lên gói mới'
            });
          }
        }

        await JobBoost.updateMany(
          { jobId, status: UserServicePackageStatus.ACTIVE },
          { $set: { status: UserServicePackageStatus.EXPIRED } }
        );
      }
    } else {
      // Backward compat: vẫn check JobBoost (legacy data trước khi có UserServicePackage)
      const existingBoost = await JobBoost.findOne({ jobId, status: 'ACTIVE' });
      if (existingBoost) {
        return res.status(400).json({ success: false, message: 'Job already boosted' });
      }
    }

    // ─── Xác định phương thức thanh toán ───
    // Nếu FE không gửi hoặc không hợp lệ → mặc định SEPAY.
    // Nếu FE gửi WALLET nhưng ví không đủ → fallback trả lỗi 400 để FE xử lý.
    const paymentMethod = requestedMethod === PaymentMethod.WALLET
      ? PaymentMethod.WALLET
      : PaymentMethod.SEPAY;

    // ─── Tính effective price: nếu upgrade thì trừ theo upgradePrice, ngược lại dùng full price ───
    const effectivePrice = (action === 'upgrade' && upgradeQuote)
      ? upgradeQuote.upgradePrice
      : pkg.price;

    // ─── WALLET FLOW: trừ tiền ví + kích hoạt ngay (không qua SePay) ───
    if (paymentMethod === PaymentMethod.WALLET) {
      // Atomic deduct: chỉ trừ khi balance vẫn còn đủ (chống race)
      const updated = await Wallet.findOneAndUpdate(
        { userId: employerId, balance: { $gte: effectivePrice } },
        { $inc: { balance: -effectivePrice, totalSpent: effectivePrice } },
        { new: true }
      );
      if (!updated) {
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_BALANCE',
          message: 'Số dư ví không đủ. Vui lòng nạp thêm hoặc chọn thanh toán qua SePay.'
        });
      }

      const balanceAfter = updated.balance;
      const balanceBefore = balanceAfter + effectivePrice;

      const transaction = await Transaction.create({
        userId: employerId,
        walletId: updated._id,
        type: TransactionType.PACKAGE_PURCHASE,
        amount: effectivePrice,
        status: TransactionStatus.SUCCESS,
        paymentMethod: PaymentMethod.WALLET,
        targetType: 'JOB',
        targetId: jobId,
        packageId,
        balanceBefore,
        balanceAfter,
        description: `Boost Job ${job.title} - ${pkg.name}${effectivePrice < pkg.price ? ` (nâng cấp từ ${activeSubscription?.packageCode || 'gói cũ'})` : ''}`,
        metadata: {
          paidAt: new Date(),
          ...(effectivePrice < pkg.price ? {
            upgradeFrom: {
              subscriptionId: activeSubscription?._id,
              packageCode: activeSubscription?.packageCode,
              pricePaid: activeSubscription?.pricePaid,
              remainingValue: upgradeQuote?.remainingValue ?? 0
            }
          } : {})
        }
      });

      // Kích hoạt gói ngay
      const { endAt } = await activatePremiumJobPackage({
        userId: employerId,
        jobId,
        pkg,
        transactionId: transaction._id
      });

      // Thông báo
      notifyPackagePurchaseSuccess({
        userId: employerId,
        transaction,
        pkg,
        endAt
      });

      return res.status(200).json({
        success: true,
        data: {
          method: PaymentMethod.WALLET,
          transactionId: transaction._id,
          amount: effectivePrice,
          fullPrice: pkg.price,
          discount: pkg.price - effectivePrice,
          newBalance: balanceAfter,
          target: { type: 'JOB', id: jobId, title: job.title }
        }
      });
    }

    // ─── SEPAY FLOW ───
    // Nếu là upgrade: amount của transaction + QR = effectivePrice.
    // Metadata.upgradeFrom giúp webhook biết cần huỷ gói cũ.
    const transaction = await Transaction.create({
      userId: employerId,
      type: TransactionType.PACKAGE_PURCHASE,
      amount: effectivePrice,
      status: TransactionStatus.PENDING,
      paymentMethod: PaymentMethod.SEPAY,
      targetType: 'JOB',
      targetId: jobId,
      packageId,
      packageSnapshot: {
        id: pkg._id,
        code: pkg.code,
        name: pkg.name,
        type: pkg.packageType,
        price: pkg.price,
        durationDays: pkg.durationDays
      },
      description: `Boost Job ${job.title} - ${pkg.name}${effectivePrice < pkg.price ? ` (nâng cấp từ ${activeSubscription?.packageCode || 'gói cũ'})` : ''}`,
      metadata: action === 'upgrade' && activeSubscription ? {
        upgradeFrom: {
          subscriptionId: activeSubscription._id,
          packageCode: activeSubscription.packageCode,
          pricePaid: activeSubscription.pricePaid,
          remainingValue: upgradeQuote?.remainingValue ?? 0,
          fullPrice: pkg.price,
          discount: pkg.price - effectivePrice
        }
      } : {}
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

    res.status(200).json({
      success: true,
      data: {
        method: PaymentMethod.SEPAY,
        transactionId: transaction._id,
        orderCode,
        amount: effectivePrice,
        fullPrice: pkg.price,
        discount: pkg.price - effectivePrice,
        qrUrl,
        transferContent,
        bankAccount,
        bankName,
        // Báo FE biết đây là luồng upgrade; gói cũ sẽ bị thay thế SAU KHI thanh toán thành công
        upgradingFrom: activeSubscription
          ? {
              name: activeSubscription.packageId?.name,
              code: activeSubscription.packageCode,
              expiredAt: activeSubscription.expiredAt,
              pricePaid: activeSubscription.pricePaid,
              remainingValue: upgradeQuote?.remainingValue ?? 0,
              daysRemaining: upgradeQuote?.daysRemaining ?? 0
            }
          : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const activateJobBoost = async (req, res) => {
  try {
    const { transactionId } = req.body;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.status !== TransactionStatus.SUCCESS) {
      return res.status(400).json({ success: false, message: 'Invalid transaction' });
    }

    if (transaction.type !== TransactionType.PACKAGE_PURCHASE || transaction.targetType !== 'JOB') {
      return res.status(400).json({ success: false, message: 'Invalid transaction type' });
    }

    const existing = await JobBoost.findOne({ jobId: transaction.targetId, status: 'ACTIVE' });
    if (existing) {
      return res.status(200).json({ success: true, message: 'Job already boosted', data: existing });
    }

    const pkg = await ServicePackage.findById(transaction.packageId);
    if (!pkg) {
      return res.status(400).json({ success: false, message: 'Package not found' });
    }

    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + (pkg.durationDays || 7) * 24 * 60 * 60 * 1000);

    const jobBoost = await JobBoost.create({
      jobId: transaction.targetId,
      employerId: transaction.userId,
      packageId: pkg._id,
      startAt,
      endAt
    });

    res.status(201).json({ success: true, data: jobBoost });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getActiveJobBoosts = async (req, res) => {
  try {
    const employerId = req.user._id;

    const boosts = await JobBoost.find({ employerId, status: 'ACTIVE' })
      .populate('jobId', 'title deadline')
      .populate('packageId', 'name durationDays price')
      .sort({ startAt: -1 });

    res.status(200).json({ success: true, data: boosts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};