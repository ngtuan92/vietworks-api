import express from 'express';
import { createBroadcast, sendToUser, getBroadcastHistory, triggerMatchJobs } from '../controllers/adminNotificationController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import { UserRole } from '../enums/userEnums.js';

const router = express.Router();

router.post('/admin/notifications/broadcast', protect, authorize(UserRole.ADMIN), createBroadcast);
router.post('/admin/notifications/users/:userId', protect, authorize(UserRole.ADMIN), sendToUser);
router.get('/admin/notifications/broadcasts', protect, authorize(UserRole.ADMIN), getBroadcastHistory);
router.post('/admin/notifications/test-match-jobs', protect, authorize(UserRole.ADMIN), triggerMatchJobs);

export default router;
