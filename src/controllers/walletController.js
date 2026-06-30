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
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
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
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const deposit = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ' });
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
      description: `Nạp tiền qua SePay - ${amount} VND`,
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
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

/**
 * SePay Bank Transfer Webhook Handler
 *
 * Luồng:
 * 1. Verify HMAC signature
 * 2. Chỉ xử lý transferType = "in" (tiền vào)
 * 3. Kiểm tra trùng lặp bằng transactionId
 * 4. Tìm transaction theo orderCode (format: SEVN{ORDER_ID})
 * 5. Verify đúng amount và status PENDING
 * 6. Update transaction + wallet
 * 7. Respond ngay lập tức (BR-01: trong 30s)
 */
// ─── Hàm xử lý chung khi 1 giao dịch ĐÃ thanh toán (dùng cho CẢ webhook lẫn polling) ───
// Trả về true nếu vừa xử lý thành công lần đầu; false nếu không hợp lệ / đã xử lý rồi.
async function processPaidTransaction(orderCode, sepay) {
  // sepay = { transactionId, amount, referenceCode, transactionDate }
  if (!orderCode || !orderCode.startsWith('SEVQR')) return false;

  // Chống trùng: sepayTransactionId này đã ghi nhận chưa
  if (sepay.transactionId) {
    const dup = await Transaction.findOne({ 'metadata.sepayTransactionId': sepay.transactionId });
    if (dup) return false;
  }

  const transaction = await Transaction.findOne({ 'metadata.orderCode': orderCode });
  if (!transaction) {
    console.error('SePay: Không tìm thấy giao dịch cho orderCode', orderCode);
    return false;
  }
  if (transaction.amount !== sepay.amount) {
    console.error(`SePay: Lệch số tiền ${orderCode}: cần ${transaction.amount}, nhận ${sepay.amount}`);
    // Mark transaction FAILED + notify user
    await Transaction.findOneAndUpdate(
      { _id: transaction._id, status: TransactionStatus.PENDING },
      {
        $set: {
          status: TransactionStatus.FAILED,
          'metadata.failedAt': new Date(),
          'metadata.failedReason': `Số tiền chuyển ${sepay.amount} không khớp yêu cầu ${transaction.amount}`
        }
      }
    );
    notifyPaymentFailed({
      userId: transaction.userId,
      transaction: { ...transaction.toObject?.() ?? transaction, status: TransactionStatus.FAILED },
      reason: `Số tiền chuyển ${sepay.amount.toLocaleString('vi-VN')} VND không khớp yêu cầu ${transaction.amount.toLocaleString('vi-VN')} VND`
    });
    return false;
  }

  // Chuyển PENDING -> SUCCESS NGUYÊN TỬ (lần 2 trả null → không xử lý lại)
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

  // Chỉ cộng tiền vào ví nếu đây là giao dịch nạp tiền ví (WALLET_DEPOSIT)
  // Nếu là mua gói trực tiếp (PACKAGE_PURCHASE), tiền này thuộc về hệ thống, không cộng vào ví user.
  if (updated.type === 'WALLET_DEPOSIT') {
    await Wallet.findOneAndUpdate(
      { userId: updated.userId },
      {
        $inc: {
          balance: sepay.amount,
          totalDeposited: sepay.amount > 0 ? sepay.amount : 0,
          totalSpent: sepay.amount < 0 ? Math.abs(sepay.amount) : 0
        }
      }
    );
  }

  // Mua gói boost → kích hoạt ngay
  if (updated.type === TransactionType.PACKAGE_PURCHASE) {
    // Luôn lấy data ServicePackage mới nhất từ DB (snapshot cũ có thể thiếu field do Mongoose strip null/undefined)
    // Chỉ fallback về snapshot nếu DB lookup thất bại (rất hiếm — package đã bị xoá).
    const freshPkg = updated.packageId
      ? await ServicePackage.findById(updated.packageId).lean()
      : null;
    const pkg = freshPkg || (updated.packageSnapshot && updated.packageSnapshot.code ? updated.packageSnapshot : null);
    if (pkg) {
      const startAt = new Date();
      const durationDays = pkg.durationDays || 7;
      const endAt = new Date(startAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // ─── Tạo UserServicePackage (source of truth cho subscription cấp user) ───
      try {
        const existed = await UserServicePackage.findOne({
          transactionId: updated._id
        });
        if (!existed) {
          const pkgId = (pkg._id || pkg.id || updated.packageId)?.toString();
          await UserServicePackage.create({
            userId: updated.userId,
            packageId: pkgId,
            // Defensive defaults: pkg có thể là fresh ServicePackage (.lean()) HOẶC snapshot cũ.
            // Tránh validation error khi cả 6 field đều undefined.
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
        console.error('Tạo UserServicePackage lỗi (không rollback):', err.message);
      }

      // ─── Tạo CvBoost / JobBoost (giữ backward compat - dùng cho query nhanh) ───
      // ─── ĐỒNG THỜI: cập nhật field "premium" / "boosted" trên Job/CV để query sort ───
      if (updated.targetType === 'CV') {
        // ─── UPGRADE: huỷ gói cũ (nếu có) trước khi tạo gói mới ───
        // Logic: UserServicePackage ACTIVE có cùng (userId, targetType=CV, targetId=cvId)
        // nhưng transactionId KHÁC transaction hiện tại ⇒ đây là luồng upgrade.
        // Chỉ thực hiện khi transaction SUCCESS (đã thanh toán thành công).
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

          // Đồng bộ CvBoost cũ sang EXPIRED (nếu có)
          await CvBoost.updateMany(
            { cvId: updated.targetId, status: 'ACTIVE' },
            { $set: { status: 'EXPIRED' } }
          );

          // Tạm thời tắt cờ boosted trên CV; sẽ được set lại true ngay bên dưới bằng gói mới
          await UploadedCV.updateOne(
            { _id: updated.targetId, userId: updated.userId },
            { $set: { isBoosted: false, boostedUntil: null } }
          );

          // Notify user rằng gói cũ đã bị thay thế (sau khi CK thành công)
          const oldTxn = await Transaction.findById(oldSub.transactionId).lean();
          if (oldTxn) {
            notifyPaymentCancelled({
              userId: updated.userId,
              transaction: oldTxn,
              reason: 'Đã nâng cấp lên gói mới'
            });
          }
        }

        const ex = await CvBoost.findOne({ cvId: updated.targetId, status: 'ACTIVE' });
        if (!ex) {
          await CvBoost.create({ cvId: updated.targetId, userId: updated.userId, packageId: pkg._id, startAt, endAt });
          // Set CV thành "boosted" để Talent Pool sort ưu tiên
          await UploadedCV.updateOne(
            { _id: updated.targetId, userId: updated.userId },
            { $set: { isBoosted: true, boostedUntil: endAt } }
          );
        }
      } else if (updated.targetType === 'JOB') {
        const ex = await JobBoost.findOne({ jobId: updated.targetId, status: 'ACTIVE' });
        if (!ex) {
          await JobBoost.create({ jobId: updated.targetId, employerId: updated.userId, packageId: pkg._id, startAt, endAt });
          // Set Job.premium.isActive = true + isUrgent = true (nhãn GẤP) để search/list ưu tiên
          await Job.updateOne(
            { _id: updated.targetId, createdBy: updated.userId },
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
      }

      // ─── Tạo Notification (in-app) ───
      notifyPackagePurchaseSuccess({
        userId: updated.userId,
        transaction: updated,
        pkg,
        endAt
      });
    }
  } else if (updated.type === TransactionType.WALLET_DEPOSIT) {
    // ─── Notification cho nạp ví ───
    notifyWalletDepositSuccess({
      userId: updated.userId,
      transaction: updated
    });
  }

  console.log(`SePay: ✅ Đã xử lý giao dịch ${orderCode}, amount ${sepay.amount}`);
  return true;
}

export const sepayWebhook = async (req, res) => {
  // 1. Luôn respond NGAY trước khi xử lý async (tránh SePay timeout 30s)
  res.status(200).json({ success: true });

  setImmediate(async () => {
    const signature = req.headers['x-sepay-signature'] || '';
    const timestamp = req.headers['x-sepay-timestamp'] || '';
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

    // Tạo log entry NGAY từ đầu để audit (kể cả khi fail cũng phải có dấu vết)
    const parsed = parseSepayWebhook(req.body);
    const isVerifiedSignature = verifySepayWebhook(rawBody, signature, timestamp) === true
      && !!process.env.SEPAY_WEBHOOK_SECRET; // dev-mode luôn true → ghi rõ false

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
      console.error('SePay Webhook: Không thể ghi SepayWebhookLog:', logErr.message);
      // Không throw — vẫn tiếp tục xử lý transaction
    }

    try {
      // 2. Xác thực chữ ký HMAC-SHA256
      if (!isVerifiedSignature) {
        console.error('SePay Webhook: Chữ ký HMAC không hợp lệ');
        await _markLogFailed(log, 'Invalid HMAC signature');
        return;
      }

      if (parsed.transferType !== 'in') {
        // Không phải tiền vào → ghi nhận nhưng không xử lý
        await _markLogProcessed(log, { skipped: true, reason: `transferType=${parsed.transferType}` });
        return;
      }

      // 3. Xử lý (dùng chung với polling)
      const ok = await processPaidTransaction(parsed.orderCode, {
        transactionId: parsed.transactionId,
        amount: parsed.amount,
        referenceCode: parsed.referenceCode,
        transactionDate: parsed.transactionDate
      });

      await _markLogProcessed(log, {
        skipped: !ok,
        reason: ok ? null : 'processPaidTransaction trả về false (không tìm thấy / trùng / lệch tiền)'
      });
    } catch (error) {
      console.error('SePay Webhook Error:', error);
      await _markLogFailed(log, error.message);
    }
  });
};

// Helper: đánh dấu log đã xử lý thành công (hoặc skip có lý do)
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
    console.error('Không thể update SepayWebhookLog processed:', e.message);
  }
}

// Helper: đánh dấu log xử lý lỗi
async function _markLogFailed(log, errorMessage) {
  if (!log) return;
  try {
    await SepayWebhookLog.updateOne(
      { _id: log._id },
      { $set: { processed: false, processedAt: new Date(), errorMessage: (errorMessage || '').slice(0, 1000) } }
    );
  } catch (e) {
    console.error('Không thể update SepayWebhookLog failed:', e.message);
  }
}

// ─── FALLBACK: FE hỏi "đã thanh toán chưa?" → hỏi thẳng API SePay (VietinBank hay miss webhook) ───
// GET /api/transactions/sepay-check/:orderCode
export const checkSepayPayment = async (req, res) => {
  try {
    const { orderCode } = req.params;
    const transaction = await Transaction.findOne({ 'metadata.orderCode': orderCode, userId: req.user._id });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }
    // Đã xong rồi thì báo luôn
    if (transaction.status === TransactionStatus.SUCCESS) {
      return res.status(200).json({ success: true, data: { paid: true } });
    }

    // Hỏi API SePay xem tiền đã vào chưa
    const sepayTxn = await findSepayTransactionByCode(orderCode, transaction.amount);
    if (sepayTxn) {
      await processPaidTransaction(orderCode, sepayTxn);
    }

    const after = await Transaction.findById(transaction._id);
    return res.status(200).json({ success: true, data: { paid: after.status === TransactionStatus.SUCCESS } });
  } catch (error) {
    console.error('checkSepayPayment error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
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
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// ─── GET /api/transactions/by-order-code/:orderCode ───
// FE PaymentSuccess page gọi để lấy chi tiết giao dịch + gói + target
export const getTransactionByOrderCode = async (req, res) => {
  try {
    const { orderCode } = req.params;
    const userId = req.user._id;

    const transaction = await Transaction.findOne({
      'metadata.orderCode': orderCode,
      userId
    }).lean();

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }

    // Lấy package info
    let packageInfo = transaction.packageSnapshot || null;
    if (!packageInfo && transaction.packageId) {
      packageInfo = await ServicePackage.findById(transaction.packageId)
        .select('name code packageType durationDays benefits price')
        .lean();
    }

    // Lấy UserServicePackage tương ứng (theo transactionId)
    const userServicePackage = await UserServicePackage.findOne({
      transactionId: transaction._id
    })
      .select('startedAt expiredAt status packageType targetType targetId')
      .lean();

    // Lấy target info (CV title hoặc Job title)
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
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// ─── GET /api/employer/my-subscriptions | /api/jobseeker/my-subscriptions ───
// List các UserServicePackage của user (có thể filter theo status / targetType)
export const getMySubscriptions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, targetType, page = 1, limit = 20 } = req.query;

    const filter = { userId };
    if (status) filter.status = status;
    if (targetType) filter.targetType = targetType;

    const subscriptions = await UserServicePackage.find(filter)
      .populate('packageId', 'name code packageType durationDays benefits price') // Fallback cho dữ liệu cũ
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

      // Tự tính số ngày còn lại để FE đỡ phải tính
      const now = Date.now();
      const expired = s.expiredAt ? new Date(s.expiredAt).getTime() : null;
      const daysRemaining = expired ? Math.max(0, Math.ceil((expired - now) / (1000 * 60 * 60 * 24))) : null;

      // Ưu tiên dùng packageSnapshot nếu có
      const pkgInfo = s.packageSnapshot || s.packageId;

      return { ...s, packageId: pkgInfo, targetTitle, daysRemaining };
    });

    const total = await UserServicePackage.countDocuments(filter);

    // Lượt mở khóa CV còn hiệu lực (mua gói CV_UNLOCK / BUNDLE) — chỉ employer mới có
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
      expiredAt: c.expiredAt
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
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};