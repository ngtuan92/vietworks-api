import EmailLog from '../models/emailLogModels.js';

/**
 * Admin xem lịch sử email đã gửi.
 * Hỗ trợ phân trang, lọc theo trạng thái, tìm kiếm theo email/subject.
 *
 * GET /admin/email-logs?page=1&limit=20&status=SENT&search=abc
 */
export const getEmailLogs = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const skip = (page - 1) * limit;

    const query = {};

    // Lọc theo trạng thái: PENDING | SENT | FAILED
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Tìm kiếm theo email hoặc subject
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      query.$or = [
        { toEmail: regex },
        { subject: regex }
      ];
    }

    const [items, total] = await Promise.all([
      EmailLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('receiverUserId', 'fullName email role')
        .lean(),
      EmailLog.countDocuments(query)
    ]);

    // Đếm nhanh theo từng trạng thái
    const [pendingCount, sentCount, failedCount] = await Promise.all([
      EmailLog.countDocuments({ status: 'PENDING' }),
      EmailLog.countDocuments({ status: 'SENT' }),
      EmailLog.countDocuments({ status: 'FAILED' })
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        pending: pendingCount,
        sent: sentCount,
        failed: failedCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải lịch sử email' });
  }
};
