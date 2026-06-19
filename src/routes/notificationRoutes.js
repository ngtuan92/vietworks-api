import express from 'express';
import { deleteNotification, getMyNotifications, markAllNotificationsAsRead, markNotificationAsRead, getNotificationSettings, updateNotificationSettings } from '../controllers/notificationController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/notifications', protect, getMyNotifications);
router.patch('/notifications/read-all', protect, markAllNotificationsAsRead);
router.patch('/notifications/:id/read', protect, markNotificationAsRead);
router.delete('/notifications/:id', protect, deleteNotification);

router.get('/notification-settings', protect, getNotificationSettings);
router.patch('/notification-settings', protect, updateNotificationSettings);

export default router;
