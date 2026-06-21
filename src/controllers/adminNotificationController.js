import User from '../models/userModels.js';
import { Notification } from '../models/index.js';
import NotificationService from '../services/notificationService.js';
import { NotificationTypeCode } from '../enums/notificationEnums.js';
import { runMatchingJobScan } from '../jobs/matchingJobCron.js';

export const createBroadcast = async (req, res) => {
  try {
    const { title, content, targetRole, sendEmail } = req.body;
    
    if (!title || !content || !targetRole) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đủ tiêu đề, nội dung và targetRole' });
    }

    if (!['ALL', 'JOBSEEKER', 'EMPLOYER'].includes(targetRole)) {
      return res.status(400).json({ success: false, message: 'targetRole không hợp lệ' });
    }

    const query = {};
    if (targetRole !== 'ALL') {
      query.role = targetRole;
    }

    const users = await User.find(query).select('_id email fullName notificationSettings').lean();
    if (!users.length) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy user nào phù hợp' });
    }

    // Luồng này đẩy background (non-blocking) để tránh timeout request
    res.status(200).json({ 
      success: true, 
      message: `Đang gửi broadcast tới ${users.length} user...`
    });

    // Lưu log vào Notification của chính Admin
    const broadcastLog = await Notification.create({
      receiverUserId: req.user._id,
      typeCode: NotificationTypeCode.SYSTEM_UPDATE,
      title: `[Lịch sử Broadcast] ${title}`,
      content: content,
      metadata: {
        isBroadcastLog: true,
        targetRole,
        sentCount: users.length,
        sendEmail: !!sendEmail
      }
    });

    const batchSize = 100;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await Promise.all(batch.map(user => 
        NotificationService.create({
          receiverUserId: user._id,
          typeCode: NotificationTypeCode.SYSTEM_UPDATE,
          title,
          content,
          metadata: { 
            broadcastId: broadcastLog._id.toString(),
            forceEmail: !!sendEmail 
          }
        })
      ));
    }
    
    console.log(`[Broadcast] Hoàn thành gửi ${users.length} thông báo`);
  } catch (error) {
    console.error('Lỗi khi gửi broadcast:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  }
};

export const sendToUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, content, sendEmail } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp tiêu đề và nội dung' });
    }

    const user = await User.findById(userId).select('_id email fullName');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    await NotificationService.create({
      receiverUserId: user._id,
      typeCode: NotificationTypeCode.SYSTEM_UPDATE,
      title,
      content,
      metadata: { forceEmail: !!sendEmail }
    });

    res.status(200).json({ success: true, message: 'Gửi thông báo thành công' });
  } catch (error) {
    console.error('Lỗi gửi thông báo cá nhân:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getBroadcastHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [histories, total] = await Promise.all([
      Notification.find({ receiverUserId: req.user._id, 'metadata.isBroadcastLog': true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments({ receiverUserId: req.user._id, 'metadata.isBroadcastLog': true })
    ]);

    const formattedHistories = histories.map(h => ({
      _id: h._id,
      title: h.title.replace('[Lịch sử Broadcast] ', ''),
      content: h.content,
      targetRole: h.metadata?.targetRole || 'ALL',
      sentCount: h.metadata?.sentCount || 0,
      adminId: h.receiverUserId,
      sendEmail: h.metadata?.sendEmail || false,
      createdAt: h.createdAt
    }));

    res.status(200).json({
      success: true,
      data: formattedHistories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Lỗi lấy lịch sử broadcast:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const triggerMatchJobs = async (req, res) => {
  try {
    const sinceHours = Math.max(Number(req.body?.sinceHours) || 24, 1);
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    const result = await runMatchingJobScan({ since });

    res.status(200).json({
      success: true,
      message: 'Đã chạy kiểm tra việc làm phù hợp thành công',
      data: result
    });
  } catch (error) {
    console.error('Lỗi chạy kiểm tra việc làm phù hợp:', error.message);
    res.status(500).json({ success: false, message: 'Không thể chạy kiểm tra việc làm phù hợp' });
  }
};
