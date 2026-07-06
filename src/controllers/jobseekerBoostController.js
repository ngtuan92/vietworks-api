import ServicePackage from '../models/servicePackageModels.js';
import Transaction from '../models/transactionModels.js';
import CvBoost from '../models/cvBoostModels.js';
import Wallet from '../models/walletModels.js';
import UploadedCV from '../models/uploadedCvModels.js';
import UserServicePackage from '../models/userServicePackageModels.js';
import { ServicePackageType, ServicePackageTargetRole, TransactionType, TransactionStatus, PaymentMethod, UserServicePackageStatus, PackageTargetType } from '../enums/paymentEnums.js';
import { createQRPaymentUrl, generateOrderCode, buildTransferContent } from '../services/sepayService.js';
import { notifyPackagePurchaseSuccess } from '../services/paymentNotificationService.js';
import { computeJobseekerUpgradeQuote, computeUpgradeQuoteByPackage, isSamePackage } from '../utils/proration.js';

/**
 * Kích hoạt gói CV_BOOST cho 1 CV ngay lập tức (dùng cho cả WALLET lẫn SEPAY-success).
 * Tạo UserServicePackage + CvBoost + cập nhật UploadedCV.isBoosted.
 */
const activatePremiumCvPackage = async ({ userId, cvId, pkg, transactionId }) => {
  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + (pkg.durationDays || 7) * 24 * 60 * 60 * 1000);

  // UserServicePackage (source of truth)
  try {
    const existed = await UserServicePackage.findOne({ transactionId });
    if (!existed) {
      await UserServicePackage.create({
        userId,
        packageId: pkg._id,
        // Defensive defaults: tránh validation error khi ServicePackage thiếu field.
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
        targetType: 'CV',
        targetId: cvId,
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

  // CvBoost (backward compat) + cập nhật flag trên CV
  const ex = await CvBoost.findOne({ cvId, status: 'ACTIVE' });
  if (!ex) {
    await CvBoost.create({ cvId, userId, packageId: pkg._id, startAt, endAt });
    await UploadedCV.updateOne(
      { _id: cvId, userId },
      { $set: { isBoosted: true, boostedUntil: endAt } }
    );
  }

  return { startAt, endAt };
};

export const getBoostPackages = async (req, res) => {
  try {
    const packages = await ServicePackage.find({
      packageType: ServicePackageType.CV_BOOST,
      targetRole: ServicePackageTargetRole.JOBSEEKER,
      status: 'ACTIVE'
    }).sort({ price: 1 }).lean();

    // Nếu user login → enrich isOwned + activeSubscriptions cho từng package
    let activeSubsByPackage = new Map();
    if (req.user?._id) {
      const activeSubs = await UserServicePackage.find({
        userId: req.user._id,
        status: UserServicePackageStatus.ACTIVE,
        packageId: { $in: packages.map(p => p._id) }
      })
        .select('packageId targetType targetId startedAt expiredAt')
        .lean();

      for (const sub of activeSubs) {
        const key = sub.packageId.toString();
        if (!activeSubsByPackage.has(key)) activeSubsByPackage.set(key, []);
        activeSubsByPackage.get(key).push({
          _id: sub._id,
          targetType: sub.targetType,
          targetId: sub.targetId,
          startedAt: sub.startedAt,
          expiredAt: sub.expiredAt,
          daysRemaining: sub.expiredAt
            ? Math.max(0, Math.ceil((new Date(sub.expiredAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null
        });
      }
    }

    const enriched = packages.map(pkg => {
      const subs = activeSubsByPackage.get(pkg._id.toString()) || [];
      return { ...pkg, isOwned: subs.length > 0, activeSubscriptions: subs, activeCount: subs.length };
    });

    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Re-export computeUpgradeQuote để backward-compat với code cũ gọi từ router này.
 * Ưu tiên dùng computeJobseekerUpgradeQuote trong code mới.
 */
export { computeUpgradeQuoteByPackage as computeUpgradeQuote } from '../utils/proration.js';

export const createBoostPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cvId } = req.params;
    const { packageId, action = 'new', paymentMethod: requestedMethod } = req.body;

    const cv = await UploadedCV.findOne({ _id: cvId, userId });
    if (!cv) {
      return res.status(404).json({ success: false, message: 'CV not found or not owned by user' });
    }

    const pkg = await ServicePackage.findById(packageId);
    if (!pkg || pkg.packageType !== ServicePackageType.CV_BOOST) {
      return res.status(400).json({ success: false, message: 'Invalid package' });
    }

    // ─── Check user đã có gói ACTIVE cho CV này chưa ───
    const activeSubscription = await UserServicePackage.findOne({
      userId,
      targetType: PackageTargetType.CV,
      targetId: cvId,
      status: UserServicePackageStatus.ACTIVE
    }).populate('packageId', 'name code price durationDays');

    // ─── Tính báo giá nâng cấp NGAY TẠI ĐÂY (dùng cho cả hai nhánh action). ───
    let upgradeQuote = null;
    if (activeSubscription) {
      if (activeSubscription.packageId?._id?.toString() === pkg._id.toString()) {
        return res.status(400).json({
          success: false,
          code: 'SAME_PACKAGE_NOT_ALLOWED',
          message: 'Bạn đang sử dụng gói này rồi. Vui lòng chọn gói khác để nâng cấp hoặc đợi gói hiện tại hết hạn.'
        });
      }
      upgradeQuote = computeJobseekerUpgradeQuote(activeSubscription, pkg);
    }

    if (activeSubscription) {
      if (action !== 'upgrade') {
        // Chặn mua trùng, trả thông tin gói hiện tại + breakdown nâng cấp để FE hiển thị modal
        return res.status(400).json({
          success: false,
          code: 'ALREADY_HAS_ACTIVE_PACKAGE',
          message: `Bạn đang dùng gói "${activeSubscription.packageId?.name || activeSubscription.packageCode}" cho CV này (còn ${upgradeQuote.daysRemaining} ngày). Hãy nâng cấp hoặc đợi gói hết hạn.`,
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

    }

    // ─── Xác định phương thức thanh toán ───
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
        { userId, balance: { $gte: effectivePrice } },
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

      // Ví đã được trừ thành công → giờ mới huỷ gói cũ (tránh mất gói khi ví không đủ)
      if (action === 'upgrade' && activeSubscription) {
        activeSubscription.status = UserServicePackageStatus.CANCELLED;
        activeSubscription.cancelledAt = new Date();
        activeSubscription.cancelledReason = 'UPGRADED';
        await activeSubscription.save();
        await CvBoost.updateMany(
          { cvId, status: 'ACTIVE' },
          { $set: { status: 'EXPIRED' } }
        );
        await UploadedCV.updateOne(
          { _id: cvId, userId },
          { $set: { isBoosted: false, boostedUntil: null } }
        );
      }

      const balanceAfter = updated.balance;
      const balanceBefore = balanceAfter + effectivePrice;

      const transaction = await Transaction.create({
        userId,
        walletId: updated._id,
        type: TransactionType.PACKAGE_PURCHASE,
        amount: effectivePrice,
        status: TransactionStatus.SUCCESS,
        paymentMethod: PaymentMethod.WALLET,
        targetType: 'CV',
        targetId: cvId,
        packageId,
        balanceBefore,
        balanceAfter,
        description: `Boost CV ${cv.title} - ${pkg.name}${effectivePrice < pkg.price ? ` (nâng cấp từ ${activeSubscription?.packageCode || 'gói cũ'})` : ''}`,
        metadata: {
          paidAt: new Date(),
          ...(effectivePrice < pkg.price ? {
            upgradeFrom: {
              subscriptionId: activeSubscription?._id,
              packageCode: activeSubscription?.packageCode,
              pricePaid: activeSubscription?.pricePaid,
              remainingValue: upgradeQuote.remainingValue
            }
          } : {})
        }
      });

      // Kích hoạt gói ngay
      const { endAt } = await activatePremiumCvPackage({
        userId,
        cvId,
        pkg,
        transactionId: transaction._id
      });

      // Thông báo
      notifyPackagePurchaseSuccess({
        userId,
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
          target: { type: 'CV', id: cvId, title: cv.title }
        }
      });
    }

    // ─── SEPAY FLOW ───
    // Nếu là upgrade: amount của transaction + QR = effectivePrice (đã trừ giá trị còn lại của gói cũ).
    // Ghi metadata.upgradeFrom để webhook biết cần huỷ gói cũ.
    const transaction = await Transaction.create({
      userId,
      type: TransactionType.PACKAGE_PURCHASE,
      amount: effectivePrice,
      status: TransactionStatus.PENDING,
      paymentMethod: PaymentMethod.SEPAY,
      targetType: 'CV',
      targetId: cvId,
      packageId,
      packageSnapshot: {
        id: pkg._id,
        code: pkg.code,
        name: pkg.name,
        type: pkg.packageType,
        price: pkg.price,
        durationDays: pkg.durationDays
      },
      description: `Boost CV ${cv.title} - ${pkg.name}${effectivePrice < pkg.price ? ` (nâng cấp từ ${activeSubscription?.packageCode || 'gói cũ'})` : ''}`,
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
    const bankOwner = process.env.SEPAY_BANK_OWNER || 'NGUYEN TIEN DUNG';
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
        bankOwner,
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

export const activateCvBoost = async (req, res) => {
  try {
    const { transactionId } = req.body;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.status !== TransactionStatus.SUCCESS) {
      return res.status(400).json({ success: false, message: 'Invalid transaction' });
    }

    if (transaction.type !== TransactionType.PACKAGE_PURCHASE || transaction.targetType !== 'CV') {
      return res.status(400).json({ success: false, message: 'Invalid transaction type' });
    }

    const existing = await CvBoost.findOne({ cvId: transaction.targetId, status: 'ACTIVE' });
    if (existing) {
      return res.status(200).json({ success: true, message: 'CV already boosted', data: existing });
    }

    const pkg = await ServicePackage.findById(transaction.packageId);
    if (!pkg) {
      return res.status(400).json({ success: false, message: 'Package not found' });
    }

    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + (pkg.durationDays || 7) * 24 * 60 * 60 * 1000);

    const cvBoost = await CvBoost.create({
      cvId: transaction.targetId,
      userId: transaction.userId,
      packageId: pkg._id,
      startAt,
      endAt
    });

    res.status(201).json({ success: true, data: cvBoost });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};