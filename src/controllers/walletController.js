import Wallet from '../models/walletModels.js';
import Transaction from '../models/transactionModels.js';
import CvBoost from '../models/cvBoostModels.js';
import JobBoost from '../models/jobBoostModels.js';
import ServicePackage from '../models/servicePackageModels.js';
import UserServicePackage from '../models/userServicePackageModels.js';
import { createQRPaymentUrl, verifySepayWebhook, parseSepayWebhook, generateOrderCode, buildTransferContent, findSepayTransactionByCode } from '../services/sepayService.js';
import { createNotification } from '../services/notificationService.js';
import { PaymentMethod, TransactionType, TransactionStatus, UserServicePackageStatus, PackageTargetType } from '../enums/paymentEnums.js';
import { NotificationTypeCode, NotificationChannel } from '../enums/notificationEnums.js';
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
        bankName
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

  // Cộng tiền vào ví (nếu user có ví — vd employer nạp tiền)
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

  // Mua gói boost → kích hoạt ngay
  if (updated.type === TransactionType.PACKAGE_PURCHASE) {
    const pkg = await ServicePackage.findById(updated.packageId);
    if (pkg) {
      const startAt = new Date();
      const endAt = new Date(startAt.getTime() + (pkg.durationDays || 7) * 24 * 60 * 60 * 1000);

      // ─── Tạo UserServicePackage (source of truth cho subscription cấp user) ───
      try {
        const existed = await UserServicePackage.findOne({
          transactionId: updated._id
        });
        if (!existed) {
          await UserServicePackage.create({
            userId: updated.userId,
            packageId: pkg._id,
            packageCode: pkg.code,
            packageType: pkg.packageType,
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
      if (updated.targetType === 'CV') {
        const ex = await CvBoost.findOne({ cvId: updated.targetId, status: 'ACTIVE' });
        if (!ex) await CvBoost.create({ cvId: updated.targetId, userId: updated.userId, packageId: pkg._id, startAt, endAt });
      } else if (updated.targetType === 'JOB') {
        const ex = await JobBoost.findOne({ jobId: updated.targetId, status: 'ACTIVE' });
        if (!ex) await JobBoost.create({ jobId: updated.targetId, employerId: updated.userId, packageId: pkg._id, startAt, endAt });
      }

      // ─── Tạo Notification (in-app) ───
      try {
        await createNotification({
          receiverUserId: updated.userId,
          typeCode: NotificationTypeCode.PACKAGE_PURCHASE_SUCCESS,
          title: 'Mua gói dịch vụ thành công',
          content: `Bạn đã kích hoạt gói "${pkg.name}" thành công. Hạn sử dụng đến ${endAt.toLocaleDateString('vi-VN')}.`,
          channels: [NotificationChannel.IN_APP],
          metadata: {
            transactionId: updated._id.toString(),
            orderCode: updated.metadata?.orderCode,
            packageId: pkg._id.toString(),
            packageName: pkg.name,
            amount: updated.amount,
            expiredAt: endAt
          }
        });
      } catch (err) {
        console.error('Tạo notification PACKAGE_PURCHASE_SUCCESS lỗi:', err.message);
      }
    }
  } else if (updated.type === TransactionType.WALLET_DEPOSIT) {
    // ─── Notification cho nạp ví ───
    try {
      await createNotification({
        receiverUserId: updated.userId,
        typeCode: NotificationTypeCode.WALLET_DEPOSIT_SUCCESS,
        title: 'Nạp tiền ví thành công',
        content: `Bạn đã nạp thành công ${sepay.amount.toLocaleString('vi-VN')} VND vào ví.`,
        channels: [NotificationChannel.IN_APP],
        metadata: {
          transactionId: updated._id.toString(),
          orderCode: updated.metadata?.orderCode,
          amount: sepay.amount
        }
      });
    } catch (err) {
      console.error('Tạo notification WALLET_DEPOSIT_SUCCESS lỗi:', err.message);
    }
  }

  console.log(`SePay: ✅ Đã xử lý giao dịch ${orderCode}, amount ${sepay.amount}`);
  return true;
}

export const sepayWebhook = async (req, res) => {
  // 1. Luôn respond NGAY trước khi xử lý async (tránh SePay timeout 30s)
  res.status(200).json({ success: true });

  setImmediate(async () => {
    try {
      const signature = req.headers['x-sepay-signature'];
      const timestamp = req.headers['x-sepay-timestamp'] || '';
      const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

      // 2. Xác thực chữ ký HMAC-SHA256
      if (!verifySepayWebhook(rawBody, signature, timestamp)) {
        console.error('SePay Webhook: Chữ ký HMAC không hợp lệ');
        return;
      }

      const data = parseSepayWebhook(req.body);
      if (data.transferType !== 'in') return; // chỉ xử lý tiền vào

      // 3. Xử lý (dùng chung với polling)
      await processPaidTransaction(data.orderCode, {
        transactionId: data.transactionId,
        amount: data.amount,
        referenceCode: data.referenceCode,
        transactionDate: data.transactionDate
      });
    } catch (error) {
      console.error('SePay Webhook Error:', error);
    }
  });
};

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
    let packageInfo = null;
    if (transaction.packageId) {
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
      .populate('packageId', 'name code packageType durationDays benefits price')
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

      return { ...s, targetTitle, daysRemaining };
    });

    const total = await UserServicePackage.countDocuments(filter);

    res.status(200).json({
      success: true,
      data,
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