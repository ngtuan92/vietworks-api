import Wallet from '../models/walletModels.js';
import Transaction from '../models/transactionModels.js';
import CvBoost from '../models/cvBoostModels.js';
import CvUnlockCredit from '../models/cvUnlockCreditModels.js';
import JobBoost from '../models/jobBoostModels.js';
import Job from '../models/jobModels.js';
import ServicePackage from '../models/servicePackageModels.js';
import UserServicePackage from '../models/userServicePackageModels.js';
import UploadedCV from '../models/uploadedCvModels.js';
import SepayWebhookLog from '../models/sepayWebhookLogModels.js';
import { createQRPaymentUrl, verifySepayWebhook, parseSepayWebhook, generateOrderCode, buildTransferContent, findSepayTransactionByCode } from '../services/sepayService.js';
import { notifyWalletDepositSuccess, notifyPackagePurchaseSuccess, notifyPaymentFailed, notifyPaymentCancelled } from '../services/paymentNotificationService.js';
import { PaymentMethod, TransactionType, TransactionStatus, UserServicePackageStatus, PackageTargetType, CvUnlockCreditStatus } from '../enums/paymentEnums.js';
import { UserRole } from '../enums/userEnums.js';

export const createWallet = async (req, res) => {
  try {
    const userId = req.user._id;

    let wallet = await Wallet.findOne({ userId });
    if (wallet) {
      return res.status(200).json({ success: true, data: wallet });
    }

    wallet = await Wallet.create({ userId, balance: 0 });
    res.status(201).json({ success: true, data: wallet });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lá»—i mÃ¡y chá»§' });
  }
};

export const getWallet = async (req, res) => {
  try {
    const userId = req.user._id;

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0 });
    }

    res.status(200).json({ success: true, data: wallet });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lá»—i mÃ¡y chá»§' });
  }
};

export const deposit = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Sá»‘ tiá»n khÃ´ng há»£p lá»‡' });
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0 });
    }

    const transaction = await Transaction.create({
      userId,
      type: TransactionType.WALLET_DEPOSIT,
      amount,
      status: TransactionStatus.PENDING,
      description: `Náº¡p tiá»n qua SePay - ${amount} VND`,
      paymentMethod: PaymentMethod.SEPAY
    });

    const orderCode = generateOrderCode(transaction._id.toString());
    transaction.metadata = { orderCode };
    await transaction.save();

    const bankAccount = process.env.SEPAY_BANK_ACCOUNT || '1017588888';
    const bankName = process.env.SEPAY_BANK_NAME || 'Vietcombank';
    const bankOwner = process.env.SEPAY_BANK_OWNER || 'NGUYEN TIEN DUNG';
    const qrUrl = createQRPaymentUrl({
      account: bankAccount,
      bank: bankName,
      amount,
      orderCode
    });
    const transferContent = buildTransferContent(orderCode);

    res.status(200).json({
      success: true,
      data: {
        transactionId: transaction._id,
        orderCode,
        amount,
        qrUrl,
        transferContent,
        bankAccount,
        bankName,
        bankOwner
      }
    });
  } catch (error) {
    console.error('Deposit Error:', error);
    res.status(500).json({ success: false, message: 'Lá»—i mÃ¡y chá»§' });
  }
};

/**
 * SePay Bank Transfer Webhook Handler
 *
 * Luá»“ng:
 * 1. Verify HMAC signature
 * 2. Chá»‰ xá»­ lÃ½ transferType = "in" (tiá»n vÃ o)
 * 3. Kiá»ƒm tra trÃ¹ng láº·p báº±ng transactionId
 * 4. TÃ¬m transaction theo orderCode (format: SEVN{ORDER_ID})
 * 5. Verify Ä‘Ãºng amount vÃ  status PENDING
 * 6. Update transaction + wallet
 * 7. Respond ngay láº­p tá»©c (BR-01: trong 30s)
 */
// â”€â”€â”€ HÃ m xá»­ lÃ½ chung khi 1 giao dá»‹ch ÄÃƒ thanh toÃ¡n (dÃ¹ng cho Cáº¢ webhook láº«n polling) â”€â”€â”€
// Tráº£ vá» true náº¿u vá»«a xá»­ lÃ½ thÃ nh cÃ´ng láº§n Ä‘áº§u; false náº¿u khÃ´ng há»£p lá»‡ / Ä‘Ã£ xá»­ lÃ½ rá»“i.
async function processPaidTransaction(orderCode, sepay) {
  // sepay = { transactionId, amount, referenceCode, transactionDate }
  if (!orderCode || !orderCode.startsWith('SEVQR')) return false;

  // Chá»‘ng trÃ¹ng: sepayTransactionId nÃ y Ä‘Ã£ ghi nháº­n chÆ°a
  if (sepay.transactionId) {
    const dup = await Transaction.findOne({ 'metadata.sepayTransactionId': sepay.transactionId });
    if (dup) return false;
  }

  const transaction = await Transaction.findOne({ 'metadata.orderCode': orderCode });
  if (!transaction) {
    console.error('SePay: KhÃ´ng tÃ¬m tháº¥y giao dá»‹ch cho orderCode', orderCode);
    return false;
  }
  if (transaction.amount !== sepay.amount) {
    console.error(`SePay: Lá»‡ch sá»‘ tiá»n ${orderCode}: cáº§n ${transaction.amount}, nháº­n ${sepay.amount}`);
    // Mark transaction FAILED + notify user
    await Transaction.findOneAndUpdate(
      { _id: transaction._id, status: TransactionStatus.PENDING },
      {
        $set: {
          status: TransactionStatus.FAILED,
          'metadata.failedAt': new Date(),
          'metadata.failedReason': `Sá»‘ tiá»n chuyá»ƒn ${sepay.amount} khÃ´ng khá»›p yÃªu cáº§u ${transaction.amount}`
        }
      }
    );
    notifyPaymentFailed({
      userId: transaction.userId,
      transaction: { ...transaction.toObject?.() ?? transaction, status: TransactionStatus.FAILED },
      reason: `Sá»‘ tiá»n chuyá»ƒn ${sepay.amount.toLocaleString('vi-VN')} VND khÃ´ng khá»›p yÃªu cáº§u ${transaction.amount.toLocaleString('vi-VN')} VND`
    });
    return false;
  }

  // Chuyá»ƒn PENDING -> SUCCESS NGUYÃŠN Tá»¬ (láº§n 2 tráº£ null â†’ khÃ´ng xá»­ lÃ½ láº¡i)
  const updated = await Transaction.findOneAndUpdate(
    { _id: transaction._id, status: TransactionStatus.PENDING },
    {
      $set: {
        status: TransactionStatus.SUCCESS,
        'metadata.sepayTransactionId': sepay.transactionId,
        'metadata.sepayReferenceCode': sepay.referenceCode,
        'metadata.paidAt': sepay.transactionDate
      }
    },
    { new: true }
  );
  if (!updated) return false;

  // Mua gói boost → kích hoạt ngay
  if (updated.type === TransactionType.PACKAGE_PURCHASE) {
    // LuÃ´n láº¥y data ServicePackage má»›i nháº¥t tá»« DB (snapshot cÅ© cÃ³ thá»ƒ thiáº¿u field do Mongoose strip null/undefined)
    // Chá»‰ fallback vá» snapshot náº¿u DB lookup tháº¥t báº¡i (ráº¥t hiáº¿m â€” package Ä‘Ã£ bá»‹ xoÃ¡).
    const freshPkg = updated.packageId
      ? await ServicePackage.findById(updated.packageId).lean()
      : null;
    const pkg = freshPkg || (updated.packageSnapshot && updated.packageSnapshot.code ? updated.packageSnapshot : null);
    if (pkg) {
      const startAt = new Date();
      const durationDays = pkg.durationDays || 7;
      const endAt = new Date(startAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // â”€â”€â”€ Táº¡o UserServicePackage (source of truth cho subscription cáº¥p user) â”€â”€â”€
      try {
        const existed = await UserServicePackage.findOne({
          transactionId: updated._id
        });
        if (!existed) {
          const pkgId = (pkg._id || pkg.id || updated.packageId)?.toString();
          await UserServicePackage.create({
            userId: updated.userId,
            packageId: pkgId,
            // Defensive defaults: pkg cÃ³ thá»ƒ lÃ  fresh ServicePackage (.lean()) HOáº¶C snapshot cÅ©.
            // TrÃ¡nh validation error khi cáº£ 6 field Ä‘á»u undefined.
            packageSnapshot: {
              id: pkgId,
              code: pkg.code ?? null,
              name: pkg.name ?? null,
              type: pkg.packageType ?? pkg.type ?? null,
              price: pkg.price ?? null,
              durationDays: durationDays ?? null
            },
            packageCode: pkg.code ?? null,
            packageType: pkg.packageType ?? pkg.type ?? null,
            targetType: updated.targetType || PackageTargetType.USER,
            targetId: updated.targetId || updated.userId,
            startedAt: startAt,
            expiredAt: endAt,
            status: UserServicePackageStatus.ACTIVE,
            pricePaid: updated.amount,
            currency: updated.currency || 'VND',
            transactionId: updated._id
          });
        }
      } catch (err) {
        console.error('Táº¡o UserServicePackage lá»—i (khÃ´ng rollback):', err.message);
      }

      // â”€â”€â”€ Táº¡o CvBoost / JobBoost (giá»¯ backward compat - dÃ¹ng cho query nhanh) â”€â”€â”€
      // â”€â”€â”€ Äá»’NG THá»œI: cáº­p nháº­t field "premium" / "boosted" trÃªn Job/CV Ä‘á»ƒ query sort â”€â”€â”€
      if (updated.targetType === 'CV') {
        // â”€â”€â”€ UPGRADE: huá»· gÃ³i cÅ© (náº¿u cÃ³) trÆ°á»›c khi táº¡o gÃ³i má»›i â”€â”€â”€
        // Logic: UserServicePackage ACTIVE cÃ³ cÃ¹ng (userId, targetType=CV, targetId=cvId)
        // nhÆ°ng transactionId KHÃC transaction hiá»‡n táº¡i â‡’ Ä‘Ã¢y lÃ  luá»“ng upgrade.
        // Chá»‰ thá»±c hiá»‡n khi transaction SUCCESS (Ä‘Ã£ thanh toÃ¡n thÃ nh cÃ´ng).
        const oldSub = await UserServicePackage.findOne({
          userId: updated.userId,
          targetType: 'CV',
          targetId: updated.targetId,
          status: UserServicePackageStatus.ACTIVE,
          _id: { $ne: null },
          transactionId: { $ne: updated._id }
        });
        if (oldSub) {
          oldSub.status = UserServicePackageStatus.CANCELLED;
          oldSub.cancelledAt = new Date();
          oldSub.cancelledReason = 'UPGRADED';
          await oldSub.save();

          // Äá»“ng bá»™ CvBoost cÅ© sang EXPIRED (náº¿u cÃ³)
          await CvBoost.updateMany(
            { cvId: updated.targetId, status: 'ACTIVE' },
            { $set: { status: 'EXPIRED' } }
          );

          // Táº¡m thá»i táº¯t cá» boosted trÃªn CV; sáº½ Ä‘Æ°á»£c set láº¡i true ngay bÃªn dÆ°á»›i báº±ng gÃ³i má»›i
          await UploadedCV.updateOne(
            { _id: updated.targetId, userId: updated.userId },
            { $set: { isBoosted: false, boostedUntil: null } }
          );

          // Notify user ráº±ng gÃ³i cÅ© Ä‘Ã£ bá»‹ thay tháº¿ (sau khi CK thÃ nh cÃ´ng)
          const oldTxn = await Transaction.findById(oldSub.transactionId).lean();
          if (oldTxn) {
            notifyPaymentCancelled({
              userId: updated.userId,
              transaction: oldTxn,
              reason: 'ÄÃ£ nÃ¢ng cáº¥p lÃªn gÃ³i má»›i'
            });
          }
        }

        const ex = await CvBoost.findOne({ cvId: updated.targetId, status: 'ACTIVE' });
        if (!ex) {
          await CvBoost.create({ cvId: updated.targetId, userId: updated.userId, packageId: pkg._id, startAt, endAt });
          // Set CV thÃ nh "boosted" Ä‘á»ƒ Talent Pool sort Æ°u tiÃªn
          await UploadedCV.updateOne(
            { _id: updated.targetId, userId: updated.userId },
            { 
              $set: { 
                isBoosted: true, 
                boostedUntil: endAt,
                boostedAt: startAt,
                boostPackagePrice: pkg.price || 0
              } 
            }
          );
        }
      } else if (updated.targetType === 'JOB') {
        // ─── UPGRADE: huỷ gói cũ (nếu có) trước khi tạo gói mới ───
        const oldJobSub = await UserServicePackage.findOne({
          userId: updated.userId,
          targetType: 'JOB',
          targetId: updated.targetId,
          status: UserServicePackageStatus.ACTIVE,
          transactionId: { $ne: updated._id }
        });
        if (oldJobSub) {
          oldJobSub.status = UserServicePackageStatus.CANCELLED;
          oldJobSub.cancelledAt = new Date();
          oldJobSub.cancelledReason = 'UPGRADED';
          await oldJobSub.save();

          await JobBoost.updateMany(
            { jobId: updated.targetId, status: 'ACTIVE' },
            { $set: { status: UserServicePackageStatus.EXPIRED } }
          );

          const oldTxn = await Transaction.findById(oldJobSub.transactionId).lean();
          if (oldTxn) {
            notifyPaymentCancelled({
              userId: updated.userId,
              transaction: oldTxn,
              reason: 'Đã nâng cấp lên gói mới'
            });
          }
        }

        const ex = await JobBoost.findOne({ jobId: updated.targetId, status: 'ACTIVE' });
        if (!ex) {
          await JobBoost.create({ jobId: updated.targetId, employerId: updated.userId, packageId: pkg._id, startAt, endAt });
          await Job.updateOne(
            { _id: updated.targetId, createdBy: updated.userId },
            { 
              $set: { 
                isUrgent: true,
                'premium.startedAt': startAt,
                'premium.packagePrice': pkg.price || 0
              } 
            }
          );
        }
      } else if (pkg.packageType === 'CV_UNLOCK' || pkg.packageType === 'CV_UNLOCK_BUNDLE') {
        const credits = pkg.benefits?.cvAccessLimit || 1;
        const EmployerProfile = (await import('../models/employerProfileModels.js')).default;
        const profile = await EmployerProfile.findOne({ userId: updated.userId }).select('companyId').lean();

        await CvUnlockCredit.create({
          employerUserId: updated.userId,
          companyId: profile?.companyId || null,
          packageId: pkg._id,
          packageCode: pkg.code,
          totalCredits: credits,
          usedCredits: 0,
          remainingCredits: credits,
          pricePaid: pkg.price,
          startedAt: startAt,
          expiredAt: endAt,
          status: CvUnlockCreditStatus.ACTIVE,
          transactionId: updated._id
        });
      }

      // â”€â”€â”€ Táº¡o Notification (in-app) â”€â”€â”€
      notifyPackagePurchaseSuccess({
        userId: updated.userId,
        transaction: updated,
        pkg,
        endAt
      });
    }
  } else if (updated.type === TransactionType.WALLET_DEPOSIT) {
    // Cộng tiền vào ví (chỉ khi nạp tiền — không áp dụng cho PACKAGE_PURCHASE qua SePay)
    await Wallet.findOneAndUpdate(
      { userId: updated.userId },
      {
        $inc: {
          balance: sepay.amount,
          totalDeposited: sepay.amount > 0 ? sepay.amount : 0
        }
      }
    );
    notifyWalletDepositSuccess({
      userId: updated.userId,
      transaction: updated
    });
  }

  console.log(`SePay: âœ… ÄÃ£ xá»­ lÃ½ giao dá»‹ch ${orderCode}, amount ${sepay.amount}`);
  return true;
}

export const sepayWebhook = async (req, res) => {
  // 1. LuÃ´n respond NGAY trÆ°á»›c khi xá»­ lÃ½ async (trÃ¡nh SePay timeout 30s)
  res.status(200).json({ success: true });

  setImmediate(async () => {
    const signature = req.headers['x-sepay-signature'] || '';
    const timestamp = req.headers['x-sepay-timestamp'] || '';
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

    // Táº¡o log entry NGAY tá»« Ä‘áº§u Ä‘á»ƒ audit (ká»ƒ cáº£ khi fail cÅ©ng pháº£i cÃ³ dáº¥u váº¿t)
    const parsed = parseSepayWebhook(req.body);
    const isVerifiedSignature = verifySepayWebhook(rawBody, signature, timestamp) === true;
    const allowUnsignedWebhook = process.env.NODE_ENV !== 'production' || process.env.SEPAY_ALLOW_UNSIGNED_WEBHOOK === 'true';

    let log = null;
    try {
      log = await SepayWebhookLog.create({
        orderCode: parsed.orderCode || '',
        transactionId: String(parsed.transactionId ?? ''),
        transferAmount: parsed.amount ?? 0,
        transferType: parsed.transferType ?? '',
        transactionDate: parsed.transactionDate ? new Date(parsed.transactionDate) : null,
        gateway: parsed.gateway ?? null,
        accountNumber: parsed.accountNumber ?? null,
        subAccount: parsed.subAccount || null,
        content: parsed.content ?? null,
        referenceCode: parsed.referenceCode ?? null,
        accumulated: parsed.accumulated ?? null,
        signature: signature ? signature.slice(0, 256) : '',
        isVerifiedSignature,
        processed: false
      });
    } catch (logErr) {
      console.error('SePay Webhook: KhÃ´ng thá»ƒ ghi SepayWebhookLog:', logErr.message);
      // KhÃ´ng throw â€” váº«n tiáº¿p tá»¥c xá»­ lÃ½ transaction
    }

    try {
      // 2. XÃ¡c thá»±c chá»¯ kÃ½ HMAC-SHA256
      if (!isVerifiedSignature && !allowUnsignedWebhook) {
        console.error('SePay Webhook: chữ ký HMAC không hợp lệ');
        await _markLogFailed(log, 'Invalid HMAC signature');
        return;
      }

      if (!isVerifiedSignature && allowUnsignedWebhook) {
        console.warn('SePay Webhook: bỏ qua kiểm tra chữ ký trong môi trường dev/ngrok');
      }

      if (parsed.transferType !== 'in') {
        // KhÃ´ng pháº£i tiá»n vÃ o â†’ ghi nháº­n nhÆ°ng khÃ´ng xá»­ lÃ½
        await _markLogProcessed(log, { skipped: true, reason: `transferType=${parsed.transferType}` });
        return;
      }

      // 3. Xá»­ lÃ½ (dÃ¹ng chung vá»›i polling)
      const ok = await processPaidTransaction(parsed.orderCode, {
        transactionId: parsed.transactionId,
        amount: parsed.amount,
        referenceCode: parsed.referenceCode,
        transactionDate: parsed.transactionDate
      });

      await _markLogProcessed(log, {
        skipped: !ok,
        reason: ok ? null : 'processPaidTransaction tráº£ vá» false (khÃ´ng tÃ¬m tháº¥y / trÃ¹ng / lá»‡ch tiá»n)'
      });
    } catch (error) {
      console.error('SePay Webhook Error:', error);
      await _markLogFailed(log, error.message);
    }
  });
};

// Helper: Ä‘Ã¡nh dáº¥u log Ä‘Ã£ xá»­ lÃ½ thÃ nh cÃ´ng (hoáº·c skip cÃ³ lÃ½ do)
async function _markLogProcessed(log, { skipped = false, reason = null } = {}) {
  if (!log) return;
  try {
    await SepayWebhookLog.updateOne(
      { _id: log._id },
      {
        $set: {
          processed: !skipped,
          processedAt: new Date(),
          errorMessage: skipped && reason ? `SKIP: ${reason}` : null
        }
      }
    );
  } catch (e) {
    console.error('KhÃ´ng thá»ƒ update SepayWebhookLog processed:', e.message);
  }
}

// Helper: Ä‘Ã¡nh dáº¥u log xá»­ lÃ½ lá»—i
async function _markLogFailed(log, errorMessage) {
  if (!log) return;
  try {
    await SepayWebhookLog.updateOne(
      { _id: log._id },
      { $set: { processed: false, processedAt: new Date(), errorMessage: (errorMessage || '').slice(0, 1000) } }
    );
  } catch (e) {
    console.error('KhÃ´ng thá»ƒ update SepayWebhookLog failed:', e.message);
  }
}

// â”€â”€â”€ FALLBACK: FE há»i "Ä‘Ã£ thanh toÃ¡n chÆ°a?" â†’ há»i tháº³ng API SePay (VietinBank hay miss webhook) â”€â”€â”€
// GET /api/transactions/sepay-check/:orderCode
export const checkSepayPayment = async (req, res) => {
  try {
    const { orderCode } = req.params;
    const transaction = await Transaction.findOne({ 'metadata.orderCode': orderCode, userId: req.user._id });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'KhÃ´ng tÃ¬m tháº¥y giao dá»‹ch' });
    }
    // ÄÃ£ xong rá»“i thÃ¬ bÃ¡o luÃ´n
    if (transaction.status === TransactionStatus.SUCCESS) {
      return res.status(200).json({ success: true, data: { paid: true } });
    }

    // Há»i API SePay xem tiá»n Ä‘Ã£ vÃ o chÆ°a
    const sepayTxn = await findSepayTransactionByCode(orderCode, transaction.amount);
    if (sepayTxn) {
      console.log('SePay polling: tìm thấy giao dịch khớp', { orderCode, amount: transaction.amount });
      await processPaidTransaction(orderCode, sepayTxn);
    } else {
      console.log('SePay polling: chưa tìm thấy giao dịch khớp', { orderCode, amount: transaction.amount, transactionId: transaction._id.toString() });
    }

    const after = await Transaction.findById(transaction._id);
    return res.status(200).json({ success: true, data: { paid: after.status === TransactionStatus.SUCCESS } });
  } catch (error) {
    console.error('checkSepayPayment error:', error);
    res.status(500).json({ success: false, message: 'Lá»—i mÃ¡y chá»§' });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type, status, page = 1, limit = 20 } = req.query;

    const filter = { userId };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lá»—i mÃ¡y chá»§' });
  }
};

// â”€â”€â”€ GET /api/transactions/by-order-code/:orderCode â”€â”€â”€
// FE PaymentSuccess page gá»i Ä‘á»ƒ láº¥y chi tiáº¿t giao dá»‹ch + gÃ³i + target
export const getTransactionByOrderCode = async (req, res) => {
  try {
    const { orderCode } = req.params;
    const userId = req.user._id;

    const transaction = await Transaction.findOne({
      'metadata.orderCode': orderCode,
      userId
    }).lean();

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'KhÃ´ng tÃ¬m tháº¥y giao dá»‹ch' });
    }

    // Láº¥y package info
    let packageInfo = transaction.packageSnapshot || null;
    if (!packageInfo && transaction.packageId) {
      packageInfo = await ServicePackage.findById(transaction.packageId)
        .select('name code packageType durationDays benefits price')
        .lean();
    }

    // Láº¥y UserServicePackage tÆ°Æ¡ng á»©ng (theo transactionId)
    const userServicePackage = await UserServicePackage.findOne({
      transactionId: transaction._id
    })
      .select('startedAt expiredAt status packageType targetType targetId')
      .lean();

    // Láº¥y target info (CV title hoáº·c Job title)
    let target = null;
    if (transaction.targetType === 'CV' && transaction.targetId) {
      const UploadedCV = (await import('../models/uploadedCvModels.js')).default;
      const cv = await UploadedCV.findById(transaction.targetId).select('title').lean();
      if (cv) target = { type: 'CV', id: cv._id, title: cv.title };
    } else if (transaction.targetType === 'JOB' && transaction.targetId) {
      const Job = (await import('../models/jobModels.js')).default;
      const job = await Job.findById(transaction.targetId).select('title').lean();
      if (job) target = { type: 'JOB', id: job._id, title: job.title };
    }

    res.status(200).json({
      success: true,
      data: {
        transaction: {
          _id: transaction._id,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          type: transaction.type,
          paymentMethod: transaction.paymentMethod,
          description: transaction.description,
          createdAt: transaction.createdAt,
          orderCode: transaction.metadata?.orderCode,
          sepayReferenceCode: transaction.metadata?.sepayReferenceCode,
          paidAt: transaction.metadata?.paidAt
        },
        package: packageInfo,
        userServicePackage,
        target
      }
    });
  } catch (error) {
    console.error('getTransactionByOrderCode error:', error);
    res.status(500).json({ success: false, message: 'Lá»—i mÃ¡y chá»§' });
  }
};

// â”€â”€â”€ GET /api/employer/my-subscriptions | /api/jobseeker/my-subscriptions â”€â”€â”€
// List cÃ¡c UserServicePackage cá»§a user (cÃ³ thá»ƒ filter theo status / targetType)
export const getMySubscriptions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, targetType, page = 1, limit = 20 } = req.query;

    const filter = { userId };
    if (status) filter.status = status;
    if (targetType) filter.targetType = targetType;

    const subscriptions = await UserServicePackage.find(filter)
      .populate('packageId', 'name code packageType durationDays benefits price') // Fallback cho dá»¯ liá»‡u cÅ©
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Populate target info (CV title / Job title)
    const UploadedCV = (await import('../models/uploadedCvModels.js')).default;
    const Job = (await import('../models/jobModels.js')).default;

    const cvIds = subscriptions.filter(s => s.targetType === 'CV').map(s => s.targetId);
    const jobIds = subscriptions.filter(s => s.targetType === 'JOB').map(s => s.targetId);

    const [cvs, jobs] = await Promise.all([
      cvIds.length ? UploadedCV.find({ _id: { $in: cvIds } }).select('title').lean() : [],
      jobIds.length ? Job.find({ _id: { $in: jobIds } }).select('title').lean() : []
    ]);
    const cvMap = new Map(cvs.map(c => [c._id.toString(), c.title]));
    const jobMap = new Map(jobs.map(j => [j._id.toString(), j.title]));

    const data = subscriptions.map(s => {
      let targetTitle = null;
      if (s.targetType === 'CV') targetTitle = cvMap.get(s.targetId?.toString()) || null;
      else if (s.targetType === 'JOB') targetTitle = jobMap.get(s.targetId?.toString()) || null;

      // Tá»± tÃ­nh sá»‘ ngÃ y cÃ²n láº¡i Ä‘á»ƒ FE Ä‘á»¡ pháº£i tÃ­nh
      const now = Date.now();
      const expired = s.expiredAt ? new Date(s.expiredAt).getTime() : null;
      const daysRemaining = expired ? Math.max(0, Math.ceil((expired - now) / (1000 * 60 * 60 * 24))) : null;

      // Æ¯u tiÃªn dÃ¹ng packageSnapshot náº¿u cÃ³
      const pkgInfo = s.packageSnapshot || s.packageId;

      return { ...s, packageId: pkgInfo, targetTitle, daysRemaining };
    });

    const total = await UserServicePackage.countDocuments(filter);

    // LÆ°á»£t má»Ÿ khÃ³a CV cÃ²n hiá»‡u lá»±c (mua gÃ³i CV_UNLOCK / BUNDLE) â€” chá»‰ employer má»›i cÃ³
    const credits = await CvUnlockCredit.find({
      employerUserId: userId,
      status: CvUnlockCreditStatus.ACTIVE,
      remainingCredits: { $gt: 0 },
      expiredAt: { $gt: new Date() }
    }).populate('packageId', 'name').sort({ expiredAt: 1 }).lean();
    const unlockCredits = credits.map(c => ({
      _id: c._id,
      packageName: c.packageId?.name || c.packageCode,
      totalCredits: c.totalCredits,
      remainingCredits: c.remainingCredits,
      expiredAt: c.expiredAt,
      startedAt: c.startedAt,
      pricePaid: c.pricePaid,
      status: c.status
    }));

    res.status(200).json({
      success: true,
      data,
      unlockCredits,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('getMySubscriptions error:', error);
    res.status(500).json({ success: false, message: 'Lá»—i mÃ¡y chá»§' });
  }
};
