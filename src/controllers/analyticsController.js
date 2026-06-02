import User from '../models/userModels.js';
import { UserRole, AccountStatus } from '../enums/userEnums.js';

export const getUserGrowth = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const users = await User.find(filter).sort({ createdAt: 1 });

    let groupedData = {};
    const dateFormat = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

    users.forEach(user => {
      const date = new Date(user.createdAt);
      const key = groupBy === 'month'
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      if (!groupedData[key]) {
        groupedData[key] = { date: key, JOBSEEKER: 0, EMPLOYER: 0, ADMIN: 0, total: 0 };
      }
      groupedData[key][user.role]++;
      groupedData[key].total++;
    });

    const growthData = Object.values(groupedData);

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