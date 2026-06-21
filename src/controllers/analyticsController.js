import User from '../models/userModels.js';
import { UserRole, AccountStatus } from '../enums/userEnums.js';

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