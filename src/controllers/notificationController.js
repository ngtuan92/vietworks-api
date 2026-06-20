import { Notification } from '../models/index.js';
import { NotificationStatus } from '../enums/notificationEnums.js';

export const getMyNotifications = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const skip = (page - 1) * limit;

    const query = { receiverUserId: req.user._id, deletedAt: null };

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


export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { receiverUserId: req.user._id, deletedAt: null, status: NotificationStatus.UNREAD },
      { $set: { status: NotificationStatus.READ } }
    );

    res.json({
      success: true,
      modifiedCount: result.modifiedCount || 0,
      message: '?? ??nh d?u t?t c? th?ng b?o l? ?? ??c'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Kh?ng th? ??nh d?u t?t c? th?ng b?o' });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, receiverUserId: req.user._id, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedByUserId: req.user._id } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Kh?ng t?m th?y th?ng b?o' });
    }

    res.json({ success: true, message: '?? x?a th?ng b?o kh?i danh s?ch c?a b?n' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Kh?ng th? x?a th?ng b?o' });
  }
};
