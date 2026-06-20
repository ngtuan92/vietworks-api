import Wallet from '../models/walletModels.js';
import Transaction from '../models/transactionModels.js';
import CvBoost from '../models/cvBoostModels.js';
import JobBoost from '../models/jobBoostModels.js';
import ServicePackage from '../models/servicePackageModels.js';
import { createQRPaymentUrl, verifySepayWebhook, parseSepayWebhook, generateOrderCode, buildTransferContent } from '../services/sepayService.js';
import { PaymentMethod, TransactionType, TransactionStatus } from '../enums/paymentEnums.js';
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
export const sepayWebhook = async (req, res) => {
  // 1. Luôn respond NGAY trước khi xử lý async (BR-01)
  res.status(200).json({ success: true });

  // 2. Xử lý async để không timeout
  setImmediate(async () => {
    try {
      const signature = req.headers['x-sepay-signature'];

      // 3. Verify signature
      if (!verifySepayWebhook(req.body, signature)) {
        console.error('SePay Webhook: Invalid signature');
        return;
      }

      const data = parseSepayWebhook(req.body);

      // 4. Chỉ xử lý tiền vào (BR-02)
      if (data.transferType !== 'in') {
        console.log('SePay Webhook: Ignoring outbound transaction');
        return;
      }

      // 5. Deduplication sớm - đã có giao dịch nào ghi nhận sepayTransactionId này chưa
      const existingTxn = await Transaction.findOne({
        'metadata.sepayTransactionId': data.transactionId
      });
      if (existingTxn) {
        console.log(`SePay Webhook: Duplicate transaction ${data.transactionId}`);
        return;
      }

      // 6. Parse orderCode để tìm transaction (format: SEVN{ORDER_ID})
      const orderCode = data.orderCode;
      if (!orderCode || !orderCode.startsWith('SEVN')) {
        console.error('SePay Webhook: Invalid order code format', orderCode);
        return;
      }

      // 7. Tìm transaction theo orderCode ĐÃ LƯU (không dựng lại _id vì orderCode bị rút gọn 12 ký tự)
      const transaction = await Transaction.findOne({ 'metadata.orderCode': orderCode });
      if (!transaction) {
        console.error('SePay Webhook: Không tìm thấy giao dịch cho orderCode', orderCode);
        return;
      }
      if (transaction.amount !== data.amount) {
        console.error(`SePay Webhook: Amount mismatch. Expected ${transaction.amount}, got ${data.amount}`);
        return;
      }

      // 8. Chuyển trạng thái NGUYÊN TỬ: chỉ MỘT webhook flip được PENDING -> SUCCESS.
      //    findOneAndUpdate trả null nếu đã xử lý rồi (webhook trùng/đồng thời) -> KHÔNG cộng tiền lần 2.
      const updated = await Transaction.findOneAndUpdate(
        { _id: transaction._id, status: TransactionStatus.PENDING },
        {
          $set: {
            status: TransactionStatus.SUCCESS,
            'metadata.sepayTransactionId': data.transactionId,
            'metadata.sepayReferenceCode': data.referenceCode,
            'metadata.paidAt': data.transactionDate
          }
        },
        { new: true }
      );
      if (!updated) {
        console.log(`SePay Webhook: Transaction ${orderCode} đã xử lý hoặc không ở trạng thái PENDING`);
        return;
      }

      // 9. Cộng tiền vào ví (đảm bảo đúng-một-lần nhờ bước 8)
      await Wallet.findOneAndUpdate(
        { userId: updated.userId },
        {
          $inc: {
            balance: data.amount,
            totalDeposited: data.amount > 0 ? data.amount : 0,
            totalSpent: data.amount < 0 ? Math.abs(data.amount) : 0
          }
        }
      );

      // 10. Nếu là mua gói boost → kích hoạt ngay sau khi thanh toán thành công
      if (updated.type === TransactionType.PACKAGE_PURCHASE) {
        const pkg = await ServicePackage.findById(updated.packageId);
        if (pkg) {
          const startAt = new Date();
          const endAt = new Date(startAt.getTime() + (pkg.durationDays || 7) * 24 * 60 * 60 * 1000);

          if (updated.targetType === 'CV') {
            const existingBoost = await CvBoost.findOne({ cvId: updated.targetId, status: 'ACTIVE' });
            if (!existingBoost) {
              await CvBoost.create({
                cvId: updated.targetId,
                userId: updated.userId,
                packageId: pkg._id,
                startAt,
                endAt
              });
            }
          } else if (updated.targetType === 'JOB') {
            const existingBoost = await JobBoost.findOne({ jobId: updated.targetId, status: 'ACTIVE' });
            if (!existingBoost) {
              await JobBoost.create({
                jobId: updated.targetId,
                employerId: updated.userId,
                packageId: pkg._id,
                startAt,
                endAt
              });
            }
          }
        }
      }

      console.log(`SePay Webhook: Successfully processed transaction ${orderCode}, amount ${data.amount}`);
    } catch (error) {
      console.error('SePay Webhook Error:', error);
    }
  });
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