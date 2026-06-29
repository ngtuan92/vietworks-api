import Transaction from '../models/transactionModels.js';
import Invoice from '../models/Invoice.js';
import User from '../models/userModels.js';
import SepayWebhookLog from '../models/sepayWebhookLogModels.js';
import { TransactionType, TransactionStatus } from '../enums/paymentEnums.js';

export const getAllTransactions = async (req, res) => {
  try {
    const { type, status, userId, page = 1, limit = 20, startDate, endDate } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .populate('userId', 'fullName email role')
      .populate('packageId', 'name price')
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

export const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findById(id)
      .populate('userId', 'fullName email role phone')
      .populate('packageId', 'name price duration');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }

    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getRevenueReport = async (req, res) => {
  try {
    // FE gửi lên ?range = 7days | 30days | 90days | year (mặc định 30days)
    const { range = '30days' } = req.query;

    const now = new Date();
    let startDate = null;
    if (range === '7days') { startDate = new Date(now); startDate.setDate(now.getDate() - 7); }
    else if (range === '30days') { startDate = new Date(now); startDate.setDate(now.getDate() - 30); }
    else if (range === '90days') { startDate = new Date(now); startDate.setDate(now.getDate() - 90); }
    else if (range === 'year') { startDate = new Date(now.getFullYear(), 0, 1); }
    // range === 'all' => không lọc thời gian

    const filter = {
      status: TransactionStatus.SUCCESS,
      type: { $in: [TransactionType.WALLET_DEPOSIT, TransactionType.PACKAGE_PURCHASE] }
    };
    if (startDate) filter.createdAt = { $gte: startDate };

    const transactions = await Transaction.find(filter)
      .populate('userId', 'role')
      .sort({ createdAt: -1 });

    // Phân loại đúng theo enum: nạp ví vs mua gói (code cũ so 'DEPOSIT'/'PAYMENT' nên luôn ra 0)
    const isDeposit = (t) => t.type === TransactionType.WALLET_DEPOSIT;
    const isPayment = (t) => t.type === TransactionType.PACKAGE_PURCHASE;

    const totalDeposits = transactions.filter(isDeposit).reduce((sum, t) => sum + t.amount, 0);
    const totalPayments = transactions.filter(isPayment).reduce((sum, t) => sum + t.amount, 0);
    const depositCount = transactions.filter(isDeposit).length;
    const paymentCount = transactions.filter(isPayment).length;
    const totalRevenue = totalDeposits + totalPayments;

    const revenueByRole = {};
    transactions.forEach(t => {
      const role = t.userId?.role || 'UNKNOWN';
      revenueByRole[role] = (revenueByRole[role] || 0) + t.amount;
    });

    // Gom theo THÁNG cho biểu đồ + bảng (FE đọc m.month, m.deposits, m.payments, m.depositsCount, m.paymentsCount)
    const monthly = {};
    transactions.forEach(t => {
      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthly[key]) monthly[key] = { month: key, deposits: 0, payments: 0, depositsCount: 0, paymentsCount: 0 };
      if (isDeposit(t)) { monthly[key].deposits += t.amount; monthly[key].depositsCount++; }
      else if (isPayment(t)) { monthly[key].payments += t.amount; monthly[key].paymentsCount++; }
    });
    const monthlyData = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month));

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalDeposits,
          totalPayments,
          depositCount,
          paymentCount,
          transactionCount: transactions.length
        },
        revenueByRole,
        monthlyData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

/**
 * Admin xem lịch sử webhook SePay đã nhận (debug/audit/replay)
 * Filter: processed, isVerifiedSignature, orderCode, startDate/endDate
 */
export const getSepayWebhookLogs = async (req, res) => {
  try {
    const {
      processed, isVerifiedSignature, orderCode,
      startDate, endDate,
      page = 1, limit = 30
    } = req.query;

    const filter = {};
    if (processed === 'true') filter.processed = true;
    else if (processed === 'false') filter.processed = false;
    if (isVerifiedSignature === 'true') filter.isVerifiedSignature = true;
    else if (isVerifiedSignature === 'false') filter.isVerifiedSignature = false;
    if (orderCode) filter.orderCode = orderCode;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 30, 1), 100);

    const [logs, total, processedCount, verifiedCount] = await Promise.all([
      SepayWebhookLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      SepayWebhookLog.countDocuments(filter),
      SepayWebhookLog.countDocuments({ ...filter, processed: true }),
      SepayWebhookLog.countDocuments({ ...filter, isVerifiedSignature: true })
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      stats: {
        total,
        processed: processedCount,
        verified: verifiedCount,
        unprocessed: total - processedCount
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('getSepayWebhookLogs error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

/**
 * Admin replay 1 webhook log (re-trigger processPaidTransaction).
 * Hữu ích khi webhook đến lỗi mạng, log ghi processed=false nhưng DB vẫn OK → muốn thử lại.
 * Cẩn thận: chỉ dùng cho debug.
 */
export const replaySepayWebhookLog = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await SepayWebhookLog.findById(id);
    if (!log) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy log' });
    }
    if (!log.orderCode) {
      return res.status(400).json({ success: false, message: 'Log không có orderCode' });
    }

    // Replay = parse lại và gọi processPaidTransaction
    const { processPaidTransaction } = await import('./walletController.js');
    const ok = await processPaidTransaction(log.orderCode, {
      transactionId: log.transactionId,
      amount: log.transferAmount,
      referenceCode: log.referenceCode,
      transactionDate: log.transactionDate
    });

    // Cập nhật log
    log.processed = ok;
    log.processedAt = new Date();
    log.errorMessage = ok ? null : 'Replay thất bại (xem transaction gốc)';
    await log.save();

    res.json({ success: true, data: { replayed: ok, log } });
  } catch (error) {
    console.error('replaySepayWebhookLog error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};