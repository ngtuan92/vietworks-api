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
        packageCode: pkg.code,
        packageType: pkg.packageType,
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

export const createBoostPayment = async (req, res) => {
  try {
    const employerId = req.user._id;
    const { jobId } = req.params;
    const { packageId, action = 'new', paymentMethod: requestedMethod } = req.body;

    const job = await Job.findOne({ _id: jobId, employerId, status: 'PUBLISHED' });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found or not owned' });
    }

    if (new Date(job.deadline) < new Date()) {
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

    if (activeSubscription) {
      if (action !== 'upgrade') {
        const daysRemaining = Math.max(
          0,
          Math.ceil((new Date(activeSubscription.expiredAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        );
        return res.status(400).json({
          success: false,
          code: 'ALREADY_HAS_ACTIVE_PACKAGE',
          message: `Tin tuyển dụng đang dùng gói "${activeSubscription.packageId?.name || activeSubscription.packageCode}" (còn ${daysRemaining} ngày). Hãy nâng cấp hoặc đợi gói hết hạn.`,
          data: {
            currentPackage: {
              name: activeSubscription.packageId?.name,
              code: activeSubscription.packageCode,
              expiredAt: activeSubscription.expiredAt,
              daysRemaining
            }
          }
        });
      }

      // action === 'upgrade': huỷ gói cũ
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
            reason: 'Nâng cấp lên gói mới'
          });
        }
      }

      await JobBoost.updateMany(
        { jobId, status: UserServicePackageStatus.ACTIVE },
        { $set: { status: UserServicePackageStatus.EXPIRED } }
      );
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

    // ─── WALLET FLOW: trừ tiền ví + kích hoạt ngay (không qua SePay) ───
    if (paymentMethod === PaymentMethod.WALLET) {
      // Atomic deduct: chỉ trừ khi balance vẫn còn đủ (chống race)
      const updated = await Wallet.findOneAndUpdate(
        { userId: employerId, balance: { $gte: pkg.price } },
        { $inc: { balance: -pkg.price, totalSpent: pkg.price } },
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
      const balanceBefore = balanceAfter + pkg.price;

      const transaction = await Transaction.create({
        userId: employerId,
        walletId: updated._id,
        type: TransactionType.PACKAGE_PURCHASE,
        amount: pkg.price,
        status: TransactionStatus.SUCCESS,
        paymentMethod: PaymentMethod.WALLET,
        targetType: 'JOB',
        targetId: jobId,
        packageId,
        balanceBefore,
        balanceAfter,
        description: `Boost Job ${job.title} - ${pkg.name}`,
        metadata: { paidAt: new Date() }
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
          amount: pkg.price,
          newBalance: balanceAfter,
          target: { type: 'JOB', id: jobId, title: job.title }
        }
      });
    }

    // ─── SEPAY FLOW (giữ nguyên logic cũ) ───
    const transaction = await Transaction.create({
      userId: employerId,
      type: TransactionType.PACKAGE_PURCHASE,
      amount: pkg.price,
      status: TransactionStatus.PENDING,
      paymentMethod: PaymentMethod.SEPAY,
      targetType: 'JOB',
      targetId: jobId,
      packageId,
      description: `Boost Job ${job.title} - ${pkg.name}`
    });

    const orderCode = generateOrderCode(transaction._id.toString());
    transaction.metadata = { orderCode };
    await transaction.save();

    const bankAccount = process.env.SEPAY_BANK_ACCOUNT || '1017588888';
    const bankName = process.env.SEPAY_BANK_NAME || 'Vietcombank';
    const qrUrl = createQRPaymentUrl({
      account: bankAccount,
      bank: bankName,
      amount: pkg.price,
      orderCode
    });
    const transferContent = buildTransferContent(orderCode);

    res.status(200).json({
      success: true,
      data: {
        method: PaymentMethod.SEPAY,
        transactionId: transaction._id,
        orderCode,
        amount: pkg.price,
        qrUrl,
        transferContent,
        bankAccount,
        bankName
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