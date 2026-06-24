import User from '../models/userModels.js';
import JobseekerProfile from '../models/jobseekerProfileModels.js';
import Company from '../models/companyModels.js';

// Escape ký tự đặc biệt để tránh regex injection / ReDoS từ ô tìm kiếm
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getAllUsers = async (req, res) => {
  try {
    const { role, accountStatus, search, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (accountStatus) filter.accountStatus = accountStatus;
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { fullName: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const userIds = users.map(u => u._id);
    const [profiles, companies] = await Promise.all([
      JobseekerProfile.find({ userId: { $in: userIds } }).select('userId avatarUrl').lean(),
      Company.find({ ownerUserId: { $in: userIds } }).select('ownerUserId avatarUrl').lean()
    ]);

    const avatarMap = {};
    profiles.forEach(p => { if (p.avatarUrl) avatarMap[p.userId] = p.avatarUrl; });
    companies.forEach(c => { if (c.avatarUrl) avatarMap[c.ownerUserId] = c.avatarUrl; });

    const usersWithAvatars = users.map(u => ({
      ...u,
      avatarUrl: avatarMap[u._id] || null
    }));

    const [total, totalEmployers, totalAdmins, totalActive] = await Promise.all([
      User.countDocuments(filter),
      User.countDocuments({ ...filter, role: 'EMPLOYER' }),
      User.countDocuments({ ...filter, role: 'ADMIN' }),
      User.countDocuments({ ...filter, accountStatus: 'ACTIVE' }),
    ]);

    res.status(200).json({
      success: true,
      data: usersWithAvatars,
      stats: { total, totalEmployers, totalAdmins, totalActive },
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

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};