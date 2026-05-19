import Transaction from '../models/Transaction.js';
import Invoice from '../models/Invoice.js';
import User from '../models/User.js';

export const getAllTransactions = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20, startDate, endDate } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findById(id)
      .populate('userId', 'fullName email role phone')
      .populate('packageId', 'name price duration');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRevenueReport = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const filter = { status: 'SUCCESS', type: { $in: ['DEPOSIT', 'PAYMENT'] } };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .populate('userId', 'role')
      .sort({ createdAt: -1 });

    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalDeposits = transactions.filter(t => t.type === 'DEPOSIT').reduce((sum, t) => sum + t.amount, 0);
    const totalPayments = transactions.filter(t => t.type === 'PAYMENT').reduce((sum, t) => sum + t.amount, 0);

    const depositCount = transactions.filter(t => t.type === 'DEPOSIT').length;
    const paymentCount = transactions.filter(t => t.type === 'PAYMENT').length;

    const revenueByRole = {};
    transactions.forEach(t => {
      const role = t.userId?.role || 'UNKNOWN';
      if (!revenueByRole[role]) revenueByRole[role] = 0;
      revenueByRole[role] += t.amount;
    });

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
        transactions: transactions.slice(0, 100)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};