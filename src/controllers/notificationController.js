import { Notification } from '../models/index.js';
import { NotificationStatus } from '../enums/notificationEnums.js';

export const getMyNotifications = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const skip = (page - 1) * limit;

    const query = { 
      receiverUserId: req.user._id, 
      deletedAt: null,
      'metadata.isBroadcastLog': { $ne: true } // Không hiện Lịch sử Broadcast trong chuông thông báo
    };
    if (req.query.status && req.query.status !== 'ALL') {
      query.status = req.query.status;
    }
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
      message: 'Đã đánh dấu tất cả thông báo là đã đọc'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể đánh dấu tất cả thông báo' });
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
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }

    res.json({ success: true, message: 'Đã xóa thông báo khỏi danh sách của bạn' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể xóa thông báo' });
  }
};

export const bulkDeleteNotifications = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách thông báo không hợp lệ' });
    }

    const result = await Notification.updateMany(
      { _id: { $in: ids }, receiverUserId: req.user._id, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedByUserId: req.user._id } }
    );

    res.json({ success: true, modifiedCount: result.modifiedCount || 0, message: `Đã xóa ${result.modifiedCount || 0} thông báo` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể xóa hàng loạt thông báo' });
  }
};

export const getNotificationSettings = async (req, res) => {
  try {
    const settings = req.user.notificationSettings || new Map();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể tải cài đặt thông báo' });
  }
};

export const updateNotificationSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Dữ liệu cài đặt không hợp lệ' });
    }

    if (!req.user.notificationSettings) {
      req.user.notificationSettings = new Map();
    }
    
    for (const key in settings) {
      req.user.notificationSettings.set(key, settings[key]);
    }

    await req.user.save();

    res.json({ success: true, data: req.user.notificationSettings, message: 'Cập nhật cài đặt thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Không thể lưu cài đặt thông báo' });
  }
};
