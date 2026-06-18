import express from 'express';
import { getMyNotifications, markNotificationAsRead } from '../controllers/notificationController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/notifications', protect, getMyNotifications);
router.patch('/notifications/:id/read', protect, markNotificationAsRead);

export default router;
