import { Application, Company, Job, Transaction } from '../models/index.js';
import { TransactionType, TransactionStatus } from '../enums/paymentEnums.js';

/**
 * GET /api/employer/analytics/dashboard
 * Trả về:
 *  - applicationsByMonth: số hồ sơ ứng tuyển theo tháng (6 tháng gần nhất)
 *  - transactionsByMonth: chi tiêu theo tháng (6 tháng gần nhất)
 */
export const getEmployerDashboardAnalytics = async (req, res) => {
  try {
    const employerUserId = req.user._id;

    // Lấy companyIds của employer
    const companies = await Company.find({ ownerUserId: employerUserId }).select('_id').lean();
    const companyIds = companies.map(c => c._id);

    if (!companyIds.length) {
      return res.json({ success: true, data: { applicationsByMonth: [], transactionsByMonth: [] } });
    }

    // 6 tháng gần nhất
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // ── Applications theo tháng ──────────────────────────────
    const appsByMonth = await Application.aggregate([
      {
        $match: {
          companyId: { $in: companyIds },
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$status', 'UNREAD'] }, 1, 0] } },
          viewed: { $sum: { $cond: [{ $eq: ['$status', 'VIEWED'] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
          hired: { $sum: { $cond: [{ $eq: ['$status', 'HIRED'] }, 1, 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // ── Transactions (chi tiêu) theo tháng ──────────────────
    const spendTypes = [
      TransactionType.PACKAGE_PURCHASE,
      TransactionType.CV_UNLOCK_SINGLE,
      TransactionType.CV_UNLOCK_BY_PACKAGE
    ];
    const txByMonth = await Transaction.aggregate([
      {
        $match: {
          userId: employerUserId,
          type: { $in: spendTypes },
          status: TransactionStatus.SUCCESS,
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          amount: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Build full 6-month scaffold
    const MONTHS_VI = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
    const scaffold = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      scaffold.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: MONTHS_VI[d.getMonth()] });
    }

    const applicationsByMonth = scaffold.map(s => {
      const found = appsByMonth.find(a => a._id.year === s.year && a._id.month === s.month);
      return {
        name: s.label,
        'Tổng hồ sơ': found?.total || 0,
        'Chưa xem': found?.unread || 0,
        'Đã xem': found?.viewed || 0,
        'Đã duyệt': found?.approved || 0,
        'Từ chối': found?.rejected || 0,
      };
    });

    const transactionsByMonth = scaffold.map(s => {
      const found = txByMonth.find(t => t._id.year === s.year && t._id.month === s.month);
      return {
        name: s.label,
        'Chi tiêu': found?.amount || 0,
      };
    });

    res.json({
      success: true,
      data: { applicationsByMonth, transactionsByMonth }
    });
  } catch (error) {
    console.error('getEmployerDashboardAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Không thể tải analytics' });
  }
};
