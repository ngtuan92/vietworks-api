import { Notification } from '../models/index.js';
import { NotificationStatus } from '../enums/notificationEnums.js';

export const getMyNotifications = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const skip = (page - 1) * limit;

    const query = { receiverUserId: req.user._id };

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, status: NotificationStatus.UNREAD })
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
      unreadCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải danh sách thông báo' });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, receiverUserId: req.user._id },
      { $set: { status: NotificationStatus.READ } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }

    res.json({ success: true, data: notification, message: 'Đã đánh dấu thông báo là đã đọc' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể cập nhật thông báo' });
  }
};
