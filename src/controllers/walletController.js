import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import { createQRPaymentUrl, verifySepayWebhook, parseSepayWebhook, generateOrderCode, buildTransferContent } from '../services/sepayService.js';

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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deposit = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0 });
    }

    const transaction = await Transaction.create({
      userId,
      type: 'DEPOSIT',
      amount,
      status: 'PENDING',
      description: `Nạp tiền qua SePay - ${amount} VND`,
      paymentMethod: 'SEPAY'
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
    res.status(500).json({ success: false, message: error.message });
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

      // 5. Deduplication - kiểm tra đã xử lý chưa
      const existingTxn = await Transaction.findOne({
        'metadata.sepayTransactionId': data.transactionId
      });
      if (existingTxn) {
        console.log(`SePay Webhook: Duplicate transaction ${data.transactionId}`);
        return;
      }

      // 6. Parse orderCode để tìm transaction
      // orderCode format: SEVN{ORDER_ID} -> cắt prefix lấy ORDER_ID
      const orderCode = data.orderCode;
      if (!orderCode || !orderCode.startsWith('SEVN')) {
        console.error('SePay Webhook: Invalid order code format', orderCode);
        return;
      }

      const orderId = orderCode.replace('SEVN', '').toLowerCase();

      // 7. Find transaction by _id (ObjectId from MongoDB)
      const transaction = await Transaction.findById(orderId);
      if (!transaction) {
        console.error('SePay Webhook: Transaction not found', orderId);
        return;
      }

      // 8. Verify business rules
      if (transaction.status !== 'PENDING') {
        console.log(`SePay Webhook: Transaction ${orderId} not PENDING (status: ${transaction.status})`);
        return;
      }

      if (transaction.amount !== data.amount) {
        console.error(`SePay Webhook: Amount mismatch. Expected ${transaction.amount}, got ${data.amount}`);
        return;
      }

      // 9. Update transaction
      transaction.status = 'SUCCESS';
      transaction.metadata = {
        ...transaction.metadata,
        sepayTransactionId: data.transactionId,
        sepayReferenceCode: data.referenceCode,
        paidAt: data.transactionDate
      };
      await transaction.save();

      // 10. Update wallet balance
      await Wallet.findOneAndUpdate(
        { userId: transaction.userId },
        { $inc: { balance: data.amount } }
      );

      console.log(`SePay Webhook: Successfully processed transaction ${orderId}, amount ${data.amount}`);
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
    res.status(500).json({ success: false, message: error.message });
  }
};