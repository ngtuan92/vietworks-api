import User from '../models/userModels.js';
import Job from '../models/jobModels.js';
import Application from '../models/applicationModels.js';
import { UserRole, AccountStatus } from '../enums/userEnums.js';
import { JobStatus, ApplicationStatus } from '../enums/jobEnums.js';

const parseDateRange = (req) => {
  const { startDate, endDate } = req.query;
  const filter = {};
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  return filter;
};

export const getUserGrowth = async (req, res) => {
  try {
    // FE gửi lên ?range = 30days | 90days | year | all
    const { range = 'year' } = req.query;

    const now = new Date();
    let startDate = null;
    if (range === '30days') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
    } else if (range === '90days') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 90);
    } else if (range === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1); // 1/1 năm nay
    }
    // range === 'all' => không lọc thời gian

    const filter = {};
    if (startDate) filter.createdAt = { $gte: startDate };

    const users = await User.find(filter).sort({ createdAt: 1 });

    // Gom theo THÁNG (key 'YYYY-MM') vì FE render mốc thời gian theo tháng (date + '-01').
    const groupedData = {};
    users.forEach(user => {
      const d = new Date(user.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groupedData[key]) {
        groupedData[key] = { date: key, JOBSEEKER: 0, EMPLOYER: 0, ADMIN: 0, total: 0 };
      }
      groupedData[key][user.role] = (groupedData[key][user.role] || 0) + 1;
      groupedData[key].total++;
    });

    // Sắp xếp theo thời gian tăng dần để biểu đồ vẽ đúng thứ tự
    const growthData = Object.values(groupedData).sort((a, b) => a.date.localeCompare(b.date));

    const summary = {
      totalUsers: users.length,
      byRole: {
        JOBSEEKER: users.filter(u => u.role === UserRole.JOBSEEKER).length,
        EMPLOYER: users.filter(u => u.role === UserRole.EMPLOYER).length,
        ADMIN: users.filter(u => u.role === UserRole.ADMIN).length
      },
      byStatus: {
        ACTIVE: users.filter(u => u.accountStatus === AccountStatus.ACTIVE).length,
        UNVERIFIED: users.filter(u => u.accountStatus === AccountStatus.UNVERIFIED).length,
        BANNED: users.filter(u => u.accountStatus === AccountStatus.BANNED).length
      }
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        growthData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// /admin/analytics/jobs
// Thống kê số lượng job theo trạng thái: DRAFT, PENDING_APPROVAL, PUBLISHED,
// CLOSED, EXPIRED, REJECTED, BANNED. Hỗ trợ filter startDate/endDate.
// ─────────────────────────────────────────────────────────────────────────
export const getJobAnalytics = async (req, res) => {
  try {
    const filter = parseDateRange(req);

    const statusGroups = await Job.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const byStatus = Object.values(JobStatus).reduce((acc, st) => {
      acc[st] = 0;
      return acc;
    }, {});
    let totalJobs = 0;
    statusGroups.forEach(g => {
      byStatus[g._id] = g.count;
      totalJobs += g.count;
    });

    // Bonus: số job premium đang active
    const premiumActive = await Job.countDocuments({
      ...filter,
      'premium.isActive': true,
      'premium.expiredAt': { $gt: new Date() }
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalJobs,
          byStatus,
          premiumActive,
          // Tỷ lệ job PUBLISHED / tổng
          publishedRate: totalJobs > 0 ? +(byStatus.PUBLISHED / totalJobs * 100).toFixed(2) : 0
        },
        range: filter.createdAt || null
      }
    });
  } catch (error) {
    console.error('getJobAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// /admin/analytics/applications
// Thống kê tổng lượt ứng tuyển trên toàn hệ thống, phân theo trạng thái,
// theo thời gian (range), theo job top, theo công ty top.
// ─────────────────────────────────────────────────────────────────────────
export const getApplicationAnalytics = async (req, res) => {
  try {
    const filter = parseDateRange(req);
    const topLimit = Math.min(parseInt(req.query.topLimit, 10) || 5, 20);

    const statusGroups = await Application.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const byStatus = Object.values(ApplicationStatus).reduce((acc, st) => {
      acc[st] = 0;
      return acc;
    }, {});
    let totalApplications = 0;
    statusGroups.forEach(g => {
      byStatus[g._id] = g.count;
      totalApplications += g.count;
    });

    // Top job nhận nhiều application nhất
    const topJobs = await Application.aggregate([
      { $match: filter },
      { $group: { _id: '$jobId', applicationCount: { $sum: 1 } } },
      { $sort: { applicationCount: -1 } },
      { $limit: topLimit },
      { $lookup: { from: 'jobs', localField: '_id', foreignField: '_id', as: 'job' } },
      { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, jobId: '$_id', title: '$job.title', applicationCount: 1 } }
    ]);

    // Top công ty có nhiều application nhất
    const topCompanies = await Application.aggregate([
      { $match: filter },
      { $group: { _id: '$companyId', applicationCount: { $sum: 1 } } },
      { $sort: { applicationCount: -1 } },
      { $limit: topLimit },
      { $lookup: { from: 'companies', localField: '_id', foreignField: '_id', as: 'company' } },
      { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, companyId: '$_id', name: '$company.name', applicationCount: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalApplications,
          byStatus,
          // Đã review (không tính UNREAD)
          reviewedRate: totalApplications > 0
            ? +((totalApplications - byStatus.UNREAD - byStatus.APPLIED) / totalApplications * 100).toFixed(2)
            : 0
        },
        topJobs,
        topCompanies,
        range: filter.createdAt || null
      }
    });
  } catch (error) {
    console.error('getApplicationAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// /admin/analytics/hiring-success
// Tính tỷ lệ hồ sơ được APPROVED + HIRED trên tổng số application.
// ─────────────────────────────────────────────────────────────────────────
export const getHiringSuccess = async (req, res) => {
  try {
    const filter = parseDateRange(req);

    const [total, approved, rejected, viewed] = await Promise.all([
      Application.countDocuments(filter),
      Application.countDocuments({ ...filter, status: ApplicationStatus.APPROVED }),
      Application.countDocuments({ ...filter, status: ApplicationStatus.REJECTED }),
      Application.countDocuments({ ...filter, status: ApplicationStatus.VIEWED })
    ]);

    const hired = 0; // Not used anymore
    const successCount = approved;
    const successRate = total > 0 ? +(successCount / total * 100).toFixed(2) : 0;
    const rejectionRate = total > 0 ? +(rejected / total * 100).toFixed(2) : 0;
    const viewedRate = total > 0 ? +((viewed + approved + hired + rejected) / total * 100).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalApplications: total,
          approved,
          hired,
          successCount,
          rejected,
          viewed,
          successRate,        // % APPROVED + HIRED / total
          rejectionRate,      // % REJECTED / total
          viewedRate          // % đã được nhà tuyển dụng review (không tính UNREAD/APPLIED) / total
        },
        range: filter.createdAt || null
      }
    });
  } catch (error) {
    console.error('getHiringSuccess error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};